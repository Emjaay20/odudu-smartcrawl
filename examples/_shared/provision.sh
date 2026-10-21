#!/usr/bin/env bash
# Makes what the examples sign in with, in the `demo` tenant of a running
# quickstart stack: the person `ada`, a web app and a service. Run it from the
# folder that holds compose.yaml, or set COMPOSE_FILE. Running it again
# changes nothing.
#
# Every secret here is published in this repository. They are for a stack on
# your own machine and must never be used anywhere else.
set -euo pipefail

WEB_APP_ORIGIN="${WEB_APP_ORIGIN:-http://localhost:8081}"

seed() {
  local output
  if ! output=$(docker compose exec -T odudu odudu seed "$@" 2>&1); then
    case "$output" in
      *"already exists"*) return 0 ;;
      *) printf '%s\n' "$output" >&2; return 1 ;;
    esac
  fi
  printf '%s\n' "$output"
}

seed tenant --name demo
seed user --tenant demo --username ada --password 'a long and unremarkable passphrase'
seed client --tenant demo --client-id example-web --client-secret example-web-secret \
  --redirect-uri "$WEB_APP_ORIGIN/callback"
seed client --tenant demo --client-id example-m2m --client-secret example-m2m-secret \
  --grant-type client_credentials
