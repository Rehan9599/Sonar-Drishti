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
