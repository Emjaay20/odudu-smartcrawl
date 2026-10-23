#!/usr/bin/env bash
# Runs the quick start the way a stranger does, on a clean Docker host: the
# repository's own compose file, one bare `docker compose up -d`, the first
# administrator's banner, a sign-in to the console in a browser, and the
# documentation from the server's own address. Twice: once with a generated
# password, once with an email and a password awkward for a shell, given in
# the environment. Exits 0 when a person could be signed in within ten minutes.
#   quickstart/prove.sh [<port>]
# Needs the image as ghcr.io/wizzywit/odudu:0.0.0, the name compose.yaml gives
# it, built from this checkout:
#   docker build -f infra/docker/Dockerfile -t ghcr.io/wizzywit/odudu:0.0.0 .
# With no port the stack takes 3000, as a stranger's does; give one where 3000
# is not free.
set -Eeuo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="ghcr.io/wizzywit/odudu:0.0.0"
BUDGET_SECONDS=600
port="${1:-3000}"
base="http://localhost:$port"
work="$(mktemp -d)"
project="odudu-qs-$port"

if ! docker image inspect "$IMAGE" > /dev/null 2>&1; then
  echo "prove: $IMAGE is not built; see the top of this script" >&2
  exit 1
fi
unset ODUDU_ADMIN_EMAIL ODUDU_ADMIN_PASSWORD ODUDU_PORT ODUDU_IMAGE COMPOSE_FILE
export COMPOSE_PROJECT_NAME="$project"
if [ "$port" != "3000" ]; then export ODUDU_PORT="$port"; fi

cp "$REPO/quickstart/compose.yaml" "$work/compose.yaml"
cd "$work"

stack_up() {
  docker compose up -d
  for _ in $(seq 1 90); do
    container="$(docker compose ps -q odudu)"
    if [ -n "$container" ] && \
       [ "$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container")" = "healthy" ]; then
      return 0
    fi
    sleep 2
  done
  echo "prove: the server did not become healthy" >&2
  docker compose logs setup odudu >&2 || true
  return 1
}

stack_down() { docker compose down -v --remove-orphans > /dev/null 2>&1 || true; }

failed() {
  echo "prove: failed at line $1: \`$2\`" >&2
  docker compose logs --tail 60 setup odudu >&2 || true
}
trap 'failed "$LINENO" "$BASH_COMMAND"' ERR
trap 'stack_down; rm -rf "$work"' EXIT

expect_in() {
  case "$2" in *"$1"*) ;; *) echo "prove: expected '$1' in $3" >&2; return 1 ;; esac
}

docs_served() {
  local page
  page="$(curl -fsS "$base/docs/")"
  expect_in '<title' "$page" "$base/docs/"
  expect_in 'Odudu' "$page" "$base/docs/"
}

echo "prove: generated password" >&2
stack_down
started="$(date +%s)"
stack_up
banner="$(docker compose logs --no-log-prefix setup)"
expect_in 'Odudu is ready.' "$banner" "the setup banner"
expect_in " console:  $base/console/" "$banner" "the setup banner"
expect_in ' email:    admin@odudu.local' "$banner" "the setup banner"
password="$(printf '%s\n' "$banner" | sed -n 's/^ password: //p')"
if [ -z "$password" ]; then echo "prove: the banner has no password" >&2; exit 1; fi
if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::add-mask::$password"; fi
docs_served
node "$REPO/quickstart/prove.ts" "$base" admin@odudu.local "$password"
elapsed=$(( $(date +%s) - started ))
if [ "$elapsed" -gt "$BUDGET_SECONDS" ]; then
  echo "prove: the first sign-in took ${elapsed}s, over the ${BUDGET_SECONDS}s budget" >&2
  exit 1
fi
stack_down

echo "prove: password from the environment" >&2
chosen="p'\"\$(id) chosen in the shell"
export ODUDU_ADMIN_EMAIL="ops@example.com"
export ODUDU_ADMIN_PASSWORD="$chosen"
stack_up
banner="$(docker compose logs --no-log-prefix setup)"
expect_in ' email:    ops@example.com' "$banner" "the setup banner"
case "$banner" in *" password: "*) echo "prove: the banner shows a password the person chose" >&2; exit 1 ;; esac
node "$REPO/quickstart/prove.ts" "$base" "$ODUDU_ADMIN_EMAIL" "$chosen"

echo "PASS elapsed ${elapsed}s"
