from pathlib import Path
from tempfile import TemporaryDirectory

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings

from ml.inference.pipeline import run_pipeline


from celery import shared_task
from django.utils import timezone

from .models import AuditLogEntry, Detection, DetectionJob
from .tiling import remap_detections, write_tiles


@shared_task
def architecture_test():
    return "DRISHTI Celery works"


def _merge_overlapping_detections(job, distance_px: float = 50.0) -> int:
    """
    Tiles overlap (stride < tile_size, see tiling.tile_offsets), so the same
    physical object can fall inside more than one tile and get detected once
    per tile - two Detection rows a few pixels apart for one real contact.

    Per-tile NMS (inside ConfidenceFilter) can't catch this: it only compares
    boxes within a single tile's detections. This runs once, across the whole
    job, after every tile has been scored: for each class, keep the highest-
    confidence detection in every cluster of boxes whose centres (in full
    source-image pixel space, i.e. after tiling.remap_detections) sit within
    `distance_px` of each other, and drop the rest. Matches the box-merge
    approach cited from DFSE-YOLO (see docs/pitch_deck_assets slide 6).
    """
    dets = list(Detection.objects.filter(job=job).order_by("-confidence_score"))
    kept = []
    drop_ids = []
    for d in dets:
        bbox = (d.bounding_geometry or {}).get("bbox")
        centre = ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2) \
            if bbox and len(bbox) == 4 else None
        is_dup = False
        if centre is not None:
            for k in kept:
                if k.class_label != d.class_label:
                    continue
                kbbox = (k.bounding_geometry or {}).get("bbox")
                if not kbbox or len(kbbox) != 4:
                    continue
                kcentre = ((kbbox[0] + kbbox[2]) / 2, (kbbox[1] + kbbox[3]) / 2)
                if ((centre[0] - kcentre[0]) ** 2
                        + (centre[1] - kcentre[1]) ** 2) ** 0.5 < distance_px:
                    is_dup = True
                    break
        if is_dup:
            drop_ids.append(d.detection_id)
        else:
            kept.append(d)

    if drop_ids:
        Detection.objects.filter(detection_id__in=drop_ids).delete()
    return len(drop_ids)


@shared_task(bind=True)
def run_detection_job(self, job_id):
    job = DetectionJob.objects.get(id=job_id)

    job.status = "running"
    job.started_at = timezone.now()
    job.progress = 0.0
    job.save(
        update_fields=[
            "status",
            "started_at",
            "progress",
        ]
    )

    try:
        layer = get_channel_layer()
        group = f"job_{job_id}"

        with TemporaryDirectory(prefix=f"drishti-{job_id}-") as tile_dir:
            tiles = write_tiles(job.input_path, tile_dir)
            for tile_index, tile in enumerate(tiles):
                report = run_pipeline(
                    tile.path,
                    job.source_file,
                    model_path=settings.DRISHTI_MODEL,
                    calibrator_path=settings.DRISHTI_CALIBRATOR,
                    xtf=Path(job.xtf_path) if job.xtf_path else None,
                    nav=Path(job.nav_path) if job.nav_path else None,
                )
                recs = remap_detections(
                    report["detections"], tile.x_offset, tile.y_offset
                )

                Detection.objects.bulk_create([
                    Detection(job=job, **{k: v for k, v in r.items() if k != "job_id"})
                    for r in recs
                ])

                async_to_sync(layer.group_send)(group, {
                    "type": "detection.partial",
                    "tile_index": tile_index,
                    "detections": recs,
                })

                job.progress = (tile_index + 1) / len(tiles)
                job.save(update_fields=["progress"])

        n_merged = _merge_overlapping_detections(job)

        job.status = "completed"
        job.progress = 1.0
        job.completed_at = timezone.now()
        job.save(
            update_fields=[
                "status",
                "progress",
                "completed_at",
            ]
        )
        async_to_sync(layer.group_send)(group, {
            "type": "detection.complete",
            "job_id": str(job.id),
            "total": job.detections.count(),
        })

        AuditLogEntry.objects.create(
            job=job,
            action="detection.completed",
            details={
                "message": "Detection job completed successfully.",
                "duplicates_merged": n_merged,
            },
        )

        return {
            "job_id": str(job.id),
            "status": "completed",
        }

    except Exception as exc:
        async_to_sync(get_channel_layer().group_send)(f"job_{job_id}", {
            "type": "detection.failed",
            "job_id": str(job_id),
            "error": str(exc),
        })

        job.status = "failed"
        job.error_message = str(exc)
        job.completed_at = timezone.now()
        job.save(
            update_fields=[
                "status",
                "error_message",
                "completed_at",
            ]
        )

        AuditLogEntry.objects.create(
            job=job,
            action="detection.failed",
            details={"error": str(exc)},
        )

        raise