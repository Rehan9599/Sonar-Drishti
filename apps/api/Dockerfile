FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

WORKDIR /repo

COPY apps/api/requirements.txt apps/api/requirements.txt
RUN pip install --no-cache-dir -r apps/api/requirements.txt

COPY ml/ ml/
COPY edge/ edge/
COPY apps/api/ apps/api/

WORKDIR /repo/apps/api
ENV DJANGO_SETTINGS_MODULE=drishti_api.settings PYTHONPATH=/repo

EXPOSE 8000
CMD ["python", "-m", "daphne", "-b", "0.0.0.0", "-p", "8000", "drishti_api.asgi:application"]
