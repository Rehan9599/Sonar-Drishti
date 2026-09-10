import csv
import io
from pathlib import Path

from django.conf import settings
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import AuditLogEntry, Detection, DetectionJob
from .serializers import DetectionJobSerializer, DetectionSerializer
from .tasks import run_detection_job


def _save_upload(f, subdir="uploads"):
    dest_dir = Path(settings.MEDIA_ROOT) / subdir
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f.name
    with open(dest, "wb") as out:
        for chunk in f.chunks():
            out.write(chunk)
    return str(dest)


@api_view(["POST"])
def upload(request):
    """multipart: file (required), xtf (optional), nav (optional)."""
    f = request.FILES.get("file")
    if not f:
        return Response({"detail": "file is required"}, status=400)

    job = DetectionJob.objects.create(
        source_file=f.name,
        input_path=_save_upload(f),
        xtf_path=_save_upload(request.FILES["xtf"], "nav") if request.FILES.get("xtf") else "",
        nav_path=_save_upload(request.FILES["nav"], "nav") if request.FILES.get("nav") else "",
    )
    async_result = run_detection_job.delay(str(job.id))
    job.celery_task_id = async_result.id
    job.save(update_fields=["celery_task_id"])

    return Response({"job_id": str(job.id), "status": job.status},
                    status=status.HTTP_202_ACCEPTED)


@api_view(["GET"])
def job_list(request):
    qs = DetectionJob.objects.order_by("-created_at")
    return Response(DetectionJobSerializer(qs, many=True).data)


@api_view(["GET"])
def job_detail(request, job_id):
    try:
        job = DetectionJob.objects.get(id=job_id)
    except DetectionJob.DoesNotExist:
        return Response({"detail": "job not found"}, status=404)
    return Response(DetectionJobSerializer(job).data)


@api_view(["GET"])
def detections(request, job_id):
    qs = Detection.objects.filter(job_id=job_id).order_by("created_at")
    return Response(DetectionSerializer(qs, many=True).data)


@api_view(["PATCH"])
def review(request, detection_id):
    try:
        d = Detection.objects.get(detection_id=detection_id)
    except Detection.DoesNotExist:
        return Response({"detail": "detection not found"}, status=404)

    new = request.data.get("review_status")
    if new not in ("analyst_confirmed", "analyst_rejected"):
        return Response(
            {"detail": "review_status must be analyst_confirmed or analyst_rejected"},
            status=400,
        )

    d.review_status = new
    d.save(update_fields=["review_status"])
    AuditLogEntry.objects.create(
        job=d.job, detection=d, action=new,
        actor=request.data.get("actor", ""),
        details={"previous": "pending_review"},
    )
    return Response(DetectionSerializer(d).data)


# Per-class colours for the drawn box (BGR, matches the dashboard palette).
_BOX_BGR = {
    "shipwreck": (82, 125, 44),
    "submarine_pipeline": (127, 112, 20),
    "ghost_net": (15, 97, 179),
    "mine_cylinder": (58, 64, 176),
}
_CROP = 640          # crop window we render around the detection
_PAD = 48            # minimum breathing room around the box


@api_view(["GET"])
def detection_image(request, detection_id):
    """
    The source tile for one detection, with its bounding box drawn on it.

    Tiles themselves are transient (the worker writes them into a
    TemporaryDirectory), but the uploaded image is kept and the stored bbox is in
    full source-image coordinates, so the crop is regenerated on demand here.
    """
    import cv2
    import numpy as np

    try:
        det = Detection.objects.select_related("job").get(detection_id=detection_id)
    except Detection.DoesNotExist:
        return Response({"detail": "detection not found"}, status=404)

    bbox = (det.bounding_geometry or {}).get("bbox")
    if not bbox or len(bbox) != 4:
        return Response({"detail": "detection has no bounding box"}, status=404)

    src = det.job.input_path
    if not src or not Path(src).exists():
        return Response({"detail": "source image no longer available"}, status=404)

    image = cv2.imread(str(src), cv2.IMREAD_COLOR)
    if image is None:
        return Response({"detail": "source image could not be read"}, status=404)

    h, w = image.shape[:2]
    x1, y1, x2, y2 = (float(v) for v in bbox)
    cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0

    # window big enough for the box plus padding, at least _CROP across
    half = max(_CROP / 2.0, (x2 - x1) / 2.0 + _PAD, (y2 - y1) / 2.0 + _PAD)
    cx0 = int(max(0, min(cx - half, w - 1)))
    cy0 = int(max(0, min(cy - half, h - 1)))
    cx1 = int(min(w, max(cx + half, cx0 + 1)))
    cy1 = int(min(h, max(cy + half, cy0 + 1)))

    crop = image[cy0:cy1, cx0:cx1]
    if crop.size == 0:
        return Response({"detail": "empty crop"}, status=404)

    # box in crop coordinates
    bx1 = int(round(x1 - cx0))
    by1 = int(round(y1 - cy0))
    bx2 = int(round(x2 - cx0))
    by2 = int(round(y2 - cy0))

    crop = np.ascontiguousarray(crop)
    colour = _BOX_BGR.get(det.class_label, (150, 116, 13))
    cv2.rectangle(crop, (bx1, by1), (bx2, by2), colour, 2)

    label = f"{det.class_label} {det.confidence_score:.0f}%"
    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
    ly = by1 - 8 if by1 - th - 12 >= 0 else by2 + th + 12
    cv2.rectangle(crop, (bx1, ly - th - 6), (bx1 + tw + 10, ly + 4), colour, -1)
    cv2.putText(crop, label, (bx1 + 5, ly), cv2.FONT_HERSHEY_SIMPLEX, 0.5,
                (255, 255, 255), 1, cv2.LINE_AA)

    ok, buf = cv2.imencode(".jpg", crop, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
    if not ok:
        return Response({"detail": "could not encode crop"}, status=500)

    resp = HttpResponse(buf.tobytes(), content_type="image/jpeg")
    resp["Cache-Control"] = "public, max-age=3600"
    return resp


@api_view(["GET"])
def export(request, job_id):
    fmt = request.query_params.get("format", "json")
    qs = Detection.objects.filter(job_id=job_id).order_by("created_at")
    recs = DetectionSerializer(qs, many=True).data

    if fmt == "geojson":
        return Response({
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point",
                                 "coordinates": [r["longitude"], r["latitude"]]},
                    "properties": {k: v for k, v in r.items()
                                   if k not in ("latitude", "longitude")},
                }
                for r in recs if r.get("latitude") is not None
            ],
        })

    if fmt == "csv":
        buf = io.StringIO()
        if recs:
            w = csv.DictWriter(buf, fieldnames=list(recs[0].keys()), extrasaction="ignore")
            w.writeheader()
            for r in recs:
                w.writerow({k: (v if not isinstance(v, dict) else str(v))
                            for k, v in r.items()})
        resp = HttpResponse(buf.getvalue(), content_type="text/csv")
        resp["Content-Disposition"] = f'attachment; filename="{job_id}.csv"'
        return resp

    return Response({"job_id": str(job_id), "detection_count": len(recs),
                     "detections": recs})
