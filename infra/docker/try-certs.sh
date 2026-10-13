#!/bin/sh
# Writes a self-signed certificate for the try stack's logout-sink into
# try-certs/, once. The server trusts it through NODE_EXTRA_CA_CERTS in
# compose.try.yaml; nothing else does.
set -eu
dir="$(dirname "$0")/try-certs"
[ -f "$dir/logout-sink.pem" ] && exit 0
mkdir -p "$dir"
openssl req -x509 -newkey rsa:2048 -nodes -days 825 -subj "/CN=logout-sink" \
  -addext "subjectAltName=DNS:logout-sink" \
  -keyout "$dir/logout-sink.key" -out "$dir/logout-sink.pem" 2>/dev/null
chmod 644 "$dir/logout-sink.key" "$dir/logout-sink.pem"
