"""
Django models for DRISHTI.

Detection      - one flagged anomaly: class, confidence, bbox/mask, coords, review status
DetectionJob   - one uploaded sonar log/image and its processing job (async, tracked by Celery task id)
AuditLogEntry  - append-only trail of role transitions per detection (analyst/verifier/field-operator)

Mirrors the report schema locked in docs/api_contract.md -- keep both in sync.
"""
