"""
REST endpoints:
  POST /api/upload/         -> accepts sonar image/log, creates a DetectionJob, enqueues Celery task, returns job_id
  GET  /api/jobs/<id>/       -> job status (pending / processing / done)
  GET  /api/detections/<job_id>/  -> final detections for a completed job
  GET  /api/export/<job_id>/?format=json|csv -> structured report download

Client never talks to the ML model directly -- every request routes through here,
so the model can be swapped/retrained without any frontend change.
"""
