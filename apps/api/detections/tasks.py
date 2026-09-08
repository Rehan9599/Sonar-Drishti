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
                "message": "Detection job completed successfully."
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