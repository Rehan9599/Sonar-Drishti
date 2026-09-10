#!/usr/bin/env bash
# Bring up the DRISHTI stack locally: Postgres + Redis in Docker, Django + Celery
# native from .venv. Run from repo root:  bash scripts/run_local.sh
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DOCKER="/c/Users/Rehan/AppData/Local/Programs/DockerDesktop/resources/bin"
[ -d "$DOCKER" ] && export PATH="$DOCKER:$PATH"
export PATH="$ROOT/.venv/Scripts:$PATH"
export PYTHONPATH="$ROOT"
export DRISHTI_MODEL="$ROOT/ml/models/exported/best_detector.onnx"
export DRISHTI_CALIBRATOR="$ROOT/ml/models/exported/calibrator.pkl"
set -a; [ -f .env ] && source .env; set +a

echo "== 1. Postgres + Redis containers =="
docker compose up -d postgres redis
sleep 4
docker compose ps --format "table {{.Service}}\t{{.Status}}"

echo "== 2. migrations =="
( cd apps/api && python manage.py migrate --noinput )

echo "== 3. daphne (ASGI, :8000) + celery worker =="
mkdir -p "$ROOT/.runlogs"
( cd apps/api && nohup python -m daphne -b 127.0.0.1 -p 8000 drishti_api.asgi:application \
    > "$ROOT/.runlogs/daphne.log" 2>&1 & echo "daphne pid $!" )
( cd apps/api && nohup celery -A drishti_api worker -l info -P solo \
    > "$ROOT/.runlogs/celery.log" 2>&1 & echo "celery pid $!" )
sleep 8

echo "== 4. health =="
curl -s http://127.0.0.1:8000/api/health/ ; echo
grep -E "ready\.|ERROR" "$ROOT/.runlogs/celery.log" | tail -1

cat <<EOF

Stack up.
  API      http://127.0.0.1:8000/api/
  DB       localhost:5433  (drishti/drishti)  |  Redis  localhost:6379
  logs     .runlogs/daphne.log  .runlogs/celery.log

Frontend (separate terminal):
  pnpm --filter @drishti/dashboard dev        # http://localhost:5173

Stop:
  docker compose down
  # kill the daphne + celery pids printed above (or close their shell)
EOF
