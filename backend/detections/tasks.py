"""
Celery task: run_inference_job(job_id)

1. Load the uploaded sonar waterfall image, split into horizontal tile strips.
2. For each tile: preprocess -> ml/inference/detector.py -> confidence_filter.py
3. After each tile, publish a WebSocket event via consumers.py (live per-tile push).
4. On completion: write Detection rows, generate the report (reporting/), mark job done.

Imports the trained model wrapper from ml/inference/ -- keep that module import-safe
(no training-only dependencies) so the backend container doesn't need the full ml/requirements.txt.
"""
