# syntax=docker/dockerfile:1.7
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# opencv-python-headless needs no libGL; libglib2.0-0 covers onnxruntime/opencv.
# Use HTTPS mirrors — some networks intercept plain-HTTP apt (captive portal) — and retry.
RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true; \
    apt-get update -o Acquire::Retries=5 \
 && apt-get install -y --no-install-recommends libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /repo

COPY apps/api/requirements.txt apps/api/requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip pip install -r apps/api/requirements.txt

COPY ml/ ml/
COPY edge/ edge/
COPY apps/api/ apps/api/

WORKDIR /repo/apps/api
ENV DJANGO_SETTINGS_MODULE=drishti_api.settings PYTHONPATH=/repo

EXPOSE 8000
CMD ["python", "-m", "daphne", "-b", "0.0.0.0", "-p", "8000", "drishti_api.asgi:application"]
