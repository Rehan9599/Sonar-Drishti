"""
Django Channels WebSocket consumer.

Group per job_id: "job_<id>". tasks.py sends one event per completed tile:
    {"type": "detection.partial", "tile_index": N, "detections": [...]}
and one final event on completion:
    {"type": "detection.complete", "job_id": ..., "report_url": ...}

Frontend's src/hooks/useDetectionSocket.js subscribes to this per active job.
"""
