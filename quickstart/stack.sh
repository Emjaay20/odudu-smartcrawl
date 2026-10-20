#!/usr/bin/env bash
# Starts or stops the quickstart stack under a project name of its own, so it
# runs beside any other stack and `down` takes only its containers.
#   quickstart/stack.sh up <image> <port>
#   quickstart/stack.sh down
# `up` reads ODUDU_ADMIN_EMAIL and ODUDU_ADMIN_PASSWORD from the environment
# and returns once the server answers on the port.
set -euo pipefail

cd "$(dirname "$0")"
export COMPOSE_PROJECT_NAME="${ODUDU_STACK_PROJECT:-odudu-quickstart-prove}"

case "${1:-}" in
  up)
    image="${2:?usage: stack.sh up <image> <port>}"
    port="${3:?usage: stack.sh up <image> <port>}"
    export ODUDU_IMAGE="$image"
    export ODUDU_PORT="$port"
    docker compose up -d
    for _ in $(seq 1 90); do
      if curl -fsS "http://localhost:$port/health/ready" > /dev/null 2>&1; then
        echo "odudu is ready on port $port"
        exit 0
      fi
      sleep 2
    done
    echo "odudu did not become ready on port $port" >&2
    docker compose logs setup odudu >&2 || true
    exit 1
    ;;
  down)
    docker compose down -v --remove-orphans
    ;;
  *)
    echo "usage: stack.sh up <image> <port> | down" >&2
    exit 2
    ;;
esac
