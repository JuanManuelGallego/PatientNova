#!/usr/bin/env bash
# Nightly Postgres backup: pg_dump, encrypted with age, uploaded to Cloudflare R2.
# Runs as a Railway cron service and exits. Setup and restore: docs/operations.md.
# The dump reaches disk only as ciphertext. Logs carry no connection string or key.
set -euo pipefail
umask 077

heartbeat() { # Sentry cron check-in; a monitoring outage never fails the backup itself.
  [ -n "${BACKUP_HEARTBEAT_URL:-}" ] || return 0
  curl --fail --silent --show-error --max-time 10 --output /dev/null "${BACKUP_HEARTBEAT_URL}?status=$1" \
    || echo "Warning: heartbeat check-in failed" >&2
}

workdir="$(mktemp -d)"
finish() {
  local code=$?
  rm -rf "$workdir"
  if [ "$code" -eq 0 ]; then heartbeat ok; else
    echo "Backup failed (exit $code)" >&2
    heartbeat error
  fi
  exit "$code"
}
trap finish EXIT

for name in DATABASE_URL BACKUP_AGE_RECIPIENT R2_ENDPOINT R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
  if [ -z "${!name:-}" ]; then
    echo "Missing required variable: $name" >&2
    exit 2
  fi
done

object="patientnova-$(date -u +%Y-%m-%dT%H%M%SZ).dump.age"
file="$workdir/$object"

pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" \
  | age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" --output "$file"

bytes="$(stat -c %s "$file")"
minimum="${BACKUP_MIN_BYTES:-1024}"
if [ "$bytes" -lt "$minimum" ]; then
  echo "Backup is $bytes bytes, below the $minimum byte minimum: not uploading" >&2
  exit 3
fi

RCLONE_S3_PROVIDER=Cloudflare \
RCLONE_S3_REGION=auto \
RCLONE_S3_ENDPOINT="$R2_ENDPOINT" \
RCLONE_S3_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
RCLONE_S3_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
RCLONE_S3_NO_CHECK_BUCKET=true \
  rclone copyto --retries 3 --low-level-retries 3 "$file" ":s3:$R2_BUCKET/$object"

echo "Backup uploaded: $object ($bytes bytes)"
