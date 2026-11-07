#!/usr/bin/env bash
# End-to-end check of backup.sh in throwaway containers: dump, encrypt, upload, then a real restore.
# Run from anywhere with Docker available: bash ops/db-backup/smoke-test.sh
# Touches nothing but the containers, network and image it creates.
set -euo pipefail
export MSYS_NO_PATHCONV=1

cd "$(dirname "${BASH_SOURCE[0]}")"
image=patientnova-db-backup:smoke
network=pn-backup-smoke
db=pn-backup-smoke-db
store=pn-backup-smoke-store
heartbeat=pn-backup-smoke-heartbeat
marker=smoke-marker-do-not-leak

cleanup() {
  docker rm -f "$db" "$store" "$heartbeat" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

failures=0
check() { # check <description> <command...>
  local description=$1; shift
  if "$@"; then echo "ok   - $description"; else echo "FAIL - $description"; failures=$((failures + 1)); fi
}

docker build --quiet --tag "$image" . >/dev/null

docker network create "$network" >/dev/null
docker run -d --name "$db" --network "$network" -e POSTGRES_PASSWORD=smoke -e POSTGRES_DB=app postgres:18-alpine >/dev/null
docker run -d --name "$store" --network "$network" --entrypoint sh rclone/rclone:latest \
  -c 'mkdir -p /data/backups && exec rclone serve s3 --addr :9000 --auth-key smoke-key,smoke-secret /data' >/dev/null
docker run -d --name "$heartbeat" --network "$network" nginx:alpine >/dev/null

until docker exec "$db" pg_isready -U postgres -d app -q; do sleep 1; done
sleep 2

docker exec -i "$db" psql -q -U postgres -d app -v ON_ERROR_STOP=1 >/dev/null <<SQL
CREATE EXTENSION btree_gist;
CREATE TABLE slots (id int PRIMARY KEY, provider int, note text, during tsrange,
  CONSTRAINT slots_no_overlap EXCLUDE USING gist (provider WITH =, during WITH &&));
INSERT INTO slots SELECT g, 1, '$marker', tsrange('2026-01-01'::timestamp + g * interval '1 day', '2026-01-01'::timestamp + g * interval '1 day' + interval '1 hour')
  FROM generate_series(1, 200) g;
SQL

keypair="$(docker run --rm --entrypoint age-keygen "$image" 2>&1)"
recipient="$(printf '%s\n' "$keypair" | sed -n 's/^.*[Pp]ublic key: //p' | head -1)"
identity="$(printf '%s\n' "$keypair" | grep '^AGE-SECRET-KEY-')"

run_job() { # run_job <extra docker args...>
  docker run --rm --network "$network" \
    -e DATABASE_URL="postgresql://postgres:smoke@$db:5432/app" \
    -e BACKUP_AGE_RECIPIENT="$recipient" \
    -e R2_ENDPOINT="http://$store:9000" \
    -e R2_BUCKET=backups \
    -e R2_ACCESS_KEY_ID=smoke-key \
    -e R2_SECRET_ACCESS_KEY=smoke-secret \
    -e BACKUP_HEARTBEAT_URL="http://$heartbeat/" \
    "$@" "$image"
}
objects() { docker exec "$store" sh -c 'ls /data/backups' 2>/dev/null; }
heartbeats() { docker logs "$heartbeat" 2>&1 | grep -c "status=$1" || true; }

# Happy path.
output="$(run_job 2>&1)" && status=0 || status=$?
check "job exits 0" test "$status" -eq 0
[ "$status" -eq 0 ] || printf '%s\n' "$output"
check "reports the upload" grep -q "Backup uploaded" <<<"$output"
check "logs carry no credentials" bash -c '! grep -q "smoke-secret\|postgres:smoke" <<<"$1"' _ "$output"
check "one object in the bucket" test "$(objects | wc -l)" -eq 1
check "heartbeat reported ok" test "$(heartbeats ok)" -eq 1

object="$(objects | head -1)"
check "object is named by timestamp" grep -Eq '^patientnova-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{6}Z\.dump\.age$' <<<"$object"
docker exec "$store" sh -c "cat /data/backups/$object" > .smoke.age
check "object is age ciphertext" bash -c 'head -c 21 "$1" | grep -q "age-encryption.org/v1"' _ .smoke.age
check "object does not contain the data" bash -c '! grep -q "$2" "$1"' _ .smoke.age "$marker"

# Real restore, with the private key, into a new database.
docker exec "$db" createdb -U postgres restored
docker run --rm -i --network "$network" -e PGPASSWORD=smoke --entrypoint bash -e IDENTITY="$identity" "$image" -c \
  'set -o pipefail; printf "%s\n" "$IDENTITY" > /tmp/id.txt && age --decrypt --identity /tmp/id.txt | pg_restore --no-owner --host='"$db"' --username=postgres --dbname=restored' \
  < .smoke.age && restored=0 || restored=$?
rm -f .smoke.age
check "dump restores cleanly" test "$restored" -eq 0
query() { docker exec "$db" psql -U postgres -d restored -tAc "$1"; }
check "restored every row" test "$(query "SELECT count(*) FROM slots WHERE note = '$marker'")" -eq 200
check "restored the exclusion constraint" test "$(query "SELECT count(*) FROM pg_constraint WHERE conname = 'slots_no_overlap'")" -eq 1

# Failures must be loud and must leave nothing behind.
before="$(objects | wc -l)"
run_job -e DATABASE_URL="postgresql://postgres:wrong@$db:5432/missing" >/dev/null 2>&1 && status=0 || status=$?
check "unreachable database fails the job" test "$status" -ne 0
check "failed dump uploads nothing" test "$(objects | wc -l)" -eq "$before"
check "heartbeat reported the failure" test "$(heartbeats error)" -eq 1

# Without the size check, as for a dump that dies midway: only pipefail stops this upload.
run_job -e DATABASE_URL="postgresql://postgres:wrong@$db:5432/missing" -e BACKUP_MIN_BYTES=0 >/dev/null 2>&1 && status=0 || status=$?
check "failed dump of any size fails the job" test "$status" -ne 0
check "failed dump of any size uploads nothing" test "$(objects | wc -l)" -eq "$before"

run_job -e BACKUP_AGE_RECIPIENT= >/dev/null 2>&1 && status=0 || status=$?
check "missing recipient fails the job" test "$status" -ne 0
check "missing recipient uploads nothing" test "$(objects | wc -l)" -eq "$before"

run_job -e BACKUP_MIN_BYTES=999999999 >/dev/null 2>&1 && status=0 || status=$?
check "suspiciously small dump fails the job" test "$status" -ne 0
check "small dump uploads nothing" test "$(objects | wc -l)" -eq "$before"

run_job -e R2_SECRET_ACCESS_KEY=wrong-secret >/dev/null 2>&1 && status=0 || status=$?
check "rejected upload fails the job" test "$status" -ne 0

if [ "$failures" -ne 0 ]; then echo "$failures check(s) failed"; exit 1; fi
echo "All checks passed"
