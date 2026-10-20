#!/usr/bin/env bash
# Starts infra/docker as a project of its own, makes the one administrator the
# documentation is photographed as, runs the capture against it and removes
# the stack. CI and a writer both run this; arguments go to the capture.
#   with-stack.sh --check          fail when the console no longer matches
#   with-stack.sh                  write the images and records
#   ODUDU_HOST_PORT / POSTGRES_HOST_PORT   host ports (default 3086 / 5466)
#   SHOTS_COMPOSE_PROJECT          the stack's project name (default odudu-shots)
#   SHOTS_PREBUILT=1               start the image tagged <project>-odudu instead
#                                  of building one; it must carry the revision
#                                  label of ODUDU_REVISION, or of HEAD if unset
#   SHOTS_KEEP_STACK=1             leave the stack up afterwards
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../../../.." && pwd)"
DOCKER_DIR="$REPO/infra/docker"
ADMIN_EMAIL="admin@odudu.local"

if [ ! -f "$DOCKER_DIR/.env" ]; then
  echo "infra/docker/.env is missing. Run: cp infra/docker/.env.example infra/docker/.env" >&2
  exit 1
fi

host_port="${ODUDU_HOST_PORT:-3086}"
postgres_port="${POSTGRES_HOST_PORT:-5466}"
set -a
# shellcheck source=/dev/null
source "$DOCKER_DIR/.env"
set +a
export ODUDU_CONSOLE_CLIENT_KEY="${ODUDU_CONSOLE_CLIENT_KEY:-$("$DOCKER_DIR/console-key.sh")}"
export ODUDU_HOST_PORT="$host_port"
export POSTGRES_HOST_PORT="$postgres_port"
export COMPOSE_PROJECT_NAME="${SHOTS_COMPOSE_PROJECT:-odudu-shots}"
export COMPOSE_FILE="$DOCKER_DIR/compose.yaml"
build_flag=(--build)
if [ "${SHOTS_PREBUILT:-}" = "1" ]; then
  build_flag=()
  expected_revision="${ODUDU_REVISION:-$(git -C "$REPO" rev-parse HEAD)}"
  actual_revision="$(docker image inspect "$COMPOSE_PROJECT_NAME-odudu" \
    --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' 2>/dev/null || true)"
  if [ -n "$actual_revision" ] && [ "$actual_revision" != "$expected_revision" ]; then
    echo "$COMPOSE_PROJECT_NAME-odudu was built from '$actual_revision', not '$expected_revision'." >&2
    exit 1
  fi
fi

compose() { docker compose --project-directory "$DOCKER_DIR" "$@"; }

cleanup() {
  if [ "${SHOTS_KEEP_STACK:-}" = "1" ]; then
    echo "leaving $COMPOSE_PROJECT_NAME up on http://localhost:$ODUDU_HOST_PORT" >&2
    return
  fi
  compose down -v --remove-orphans || true
}
trap cleanup EXIT

compose up -d ${build_flag[@]+"${build_flag[@]}"} --wait --wait-timeout 180 postgres odudu

# The first line `seed admin` prints is the administrator's generated password,
# which the console would ask to change at the first sign-in; clearing that one
# required action stands in for the change, so the capture signs straight in.
password="$(compose exec -T odudu node dist/main.js seed admin --username "$ADMIN_EMAIL" 2>/dev/null | head -n 1)"
compose exec -T postgres sh -c \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qc "delete from user_required_actions"'

cd "$REPO/apps/docs"
ODUDU_BASE="http://localhost:$ODUDU_HOST_PORT" \
  ODUDU_ADMIN_EMAIL="$ADMIN_EMAIL" \
  ODUDU_ADMIN_PASSWORD="$password" \
  node --no-warnings scripts/console-shots/run.ts "$@"
