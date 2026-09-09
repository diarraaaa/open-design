#!/bin/sh
# Runs as root (the container's initial user) so it can fix ownership on a
# freshly mounted data volume before dropping to the unprivileged
# `open-design` user to run the daemon. Some hosts (Railway bind-mounts, for
# example) hand back a mount owned by root regardless of the image's baked-in
# /app/.od ownership, which native `docker volume` mounts inherit but a fresh
# host bind-mount does not — so the daemon's own mkdir under /app/.od fails
# with EACCES until this runs.
set -e
chown -R open-design:open-design /app/.od
exec su-exec open-design "$@"
