ARG API_IMAGE=drishti-api:latest
FROM ${API_IMAGE}

WORKDIR /repo/apps/api
CMD ["celery", "-A", "drishti_api", "worker", "-l", "info", "--concurrency", "2"]