#!/usr/bin/env bash
# Installs Chromium's system libraries, or Chromium and its libraries, through
# the workspace's Playwright, on a runner whose apt can stall.
#   install.sh <workspace-package> install-deps|install
# A stalled attempt is killed, with the apt it started, and tried again.
set -uo pipefail

package="${1:?usage: install.sh <package> install-deps|install}"
mode="${2:?usage: install.sh <package> install-deps|install}"
attempts=3
limit="${ODUDU_INSTALL_TIMEOUT:-8m}"
sudo_cmd=""
if [ "$(id -u)" -ne 0 ]; then sudo_cmd="sudo"; fi

flags=()
if [ "$mode" = "install" ]; then flags=(--with-deps); fi

# The runner image lists its mirrors in a file that its apt sources read, so
# the sources themselves name no host; the rewrite keeps the file's format, one
# URL and its priority per line. The sed covers sources that name a host.
$sudo_cmd tee /etc/apt/apt.conf.d/80-odudu-retries > /dev/null <<'CONF'
Acquire::Retries "5";
Acquire::http::Timeout "20";
Acquire::https::Timeout "20";
Acquire::ForceIPv4 "true";
DPkg::Lock::Timeout "300";
CONF
if [ -f /etc/apt/apt-mirrors.txt ]; then
  printf 'http://archive.ubuntu.com/ubuntu/\tpriority:1\nhttp://security.ubuntu.com/ubuntu/\tpriority:2\n' \
    | $sudo_cmd tee /etc/apt/apt-mirrors.txt > /dev/null
fi
$sudo_cmd sed -i 's|http://azure.archive.ubuntu.com|http://archive.ubuntu.com|g' \
  /etc/apt/sources.list /etc/apt/sources.list.d/* 2>/dev/null || true

# The install runs apt as root, which the runner user cannot signal, so a
# timeout kills the wrapper and leaves apt holding the dpkg lock. The runner is
# ephemeral, so clearing the lock between attempts is safe.
clear_apt() {
  for name in apt-get apt dpkg; do $sudo_cmd pkill -KILL -x "$name" || true; done
  $sudo_cmd rm -f /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/cache/apt/archives/lock
  $sudo_cmd dpkg --configure -a || true
}

for attempt in $(seq 1 "$attempts"); do
  echo "attempt $attempt of $attempts"
  if setsid --wait timeout -s TERM -k 15 "$limit" \
    pnpm --filter "$package" exec playwright "$mode" ${flags[@]+"${flags[@]}"} chromium; then
    exit 0
  fi
  echo "attempt $attempt failed or timed out after $limit"
  clear_apt
done
echo "::error::Playwright's system libraries did not install in $attempts attempts of $limit each."
exit 1
