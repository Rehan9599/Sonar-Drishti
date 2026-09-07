from rest_framework import serializers

from .models import AuditLogEntry, Detection, DetectionJob


class DetectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Detection
        exclude = ("job", "created_at")


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
