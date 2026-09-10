from rest_framework import serializers

from .models import AuditLogEntry, Detection, DetectionJob


class DetectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Detection
        # explicit — the frozen 13-field detection contract, job_id included
        fields = (
            "detection_id", "job_id", "ping_id", "timestamp",
            "latitude", "longitude", "class_label", "confidence_score",
            "bounding_geometry", "across_track_m", "side",
            "review_status", "source_file",
        )


class AuditLogEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLogEntry
        fields = "__all__"


class DetectionJobSerializer(serializers.ModelSerializer):
    detection_count = serializers.IntegerField(source="detections.count", read_only=True)

    class Meta:
        model = DetectionJob
        fields = ("id", "source_file", "status", "progress", "error_message",
                  "created_at", "started_at", "completed_at", "detection_count")
