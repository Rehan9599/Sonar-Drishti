from django.db import models


class DetectionJob(models.Model):
    STATUS_CHOICES = [
        ("queued", "Queued"),
        ("running", "Running"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    id = models.UUIDField(primary_key=True, editable=False)
    input_path = models.CharField(max_length=1024)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="queued",
    )
    progress = models.FloatField(default=0.0)
    error_message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.id} - {self.status}"


class Detection(models.Model):
    job = models.ForeignKey(
        DetectionJob,
        on_delete=models.CASCADE,
        related_name="detections",
    )

    class_name = models.CharField(max_length=255)
    confidence = models.FloatField()

    x1 = models.FloatField()
    y1 = models.FloatField()
    x2 = models.FloatField()
    y2 = models.FloatField()

    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    source_tile = models.CharField(max_length=1024, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.class_name} ({self.confidence:.3f})"


class AuditLogEntry(models.Model):
    job = models.ForeignKey(
        DetectionJob,
        on_delete=models.CASCADE,
        related_name="audit_logs",
        null=True,
        blank=True,
    )

    action = models.CharField(max_length=255)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.action