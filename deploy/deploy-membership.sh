#!/usr/bin/env bash
# root 소유의 임시 release 디렉터리에 올린 소스와 OAuth JSON으로 회원 기능을 배포한다.
set -Eeuo pipefail
umask 077

release_root="$(realpath "${1:?release directory required}")"
production=/opt/nutri-kids
case "$release_root" in
  /opt/nutri-kids-membership-20261028-*) ;;
  *) echo 'Unexpected release directory' >&2; exit 1 ;;
esac
test "$EUID" -eq 0
test -f "$production/.env.production"
test -f "$release_root/source.tar.gz"
test -f "$release_root/google-client.json"
incoming="$release_root/source"
mkdir "$incoming"
tar -xzf "$release_root/source.tar.gz" -C "$incoming"

backup="$(mktemp -d /opt/nutri-kids-backup-before-google-20261028-XXXXXX)"
cp -a "$production" "$backup/source"
compose=(docker compose --project-name nutri-kids-production --env-file "$production/.env.production" -f "$production/docker-compose.prod.yml")
"${compose[@]}" exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump --single-transaction --no-tablespaces -u "$MYSQL_USER" "$MYSQL_DATABASE"' > "$backup/database.sql"
test -s "$backup/database.sql"
chmod 600 "$backup/database.sql"
suffix="$(basename "$release_root")"
api_backup="nutri-kids-production-api:before-$suffix"
frontend_backup="nutri-kids-production-frontend:before-$suffix"
docker image tag "$(docker inspect --format '{{.Image}}' nutri-kids-production-api-1)" "$api_backup"
docker image tag "$(docker inspect --format '{{.Image}}' nutri-kids-production-frontend-1)" "$frontend_backup"
printf 'BACKUP=%s\n' "$backup"

activated=0
rollback() {
  code=$?
  trap - ERR
  echo "Deployment failed. Backup: $backup" >&2
  if [ "$activated" -eq 1 ]; then
    rsync -a "$backup/source/" "$production/"
    docker image tag "$api_backup" nutri-kids-production-api:latest
    docker image tag "$frontend_backup" nutri-kids-production-frontend:latest
    "${compose[@]}" up -d --no-deps --wait --wait-timeout 180 api frontend || true
    echo 'Previous application images and configuration restored.' >&2
  fi
  exit "$code"
}
trap rollback ERR

cp -p "$production/.env.production" "$incoming/.env.production"
python3 "$incoming/backend/scripts/configure_google_oauth.py" \
  --credentials "$release_root/google-client.json" --env "$incoming/.env.production"
# 원본 다운로드 파일은 사용자 PC에 남아 있으므로 서버의 전달용 사본만 지운다.
python3 -c 'import pathlib, sys; pathlib.Path(sys.argv[1]).unlink()' "$release_root/google-client.json"
staged_compose=(docker compose --project-name nutri-kids-production --env-file "$incoming/.env.production" -f "$incoming/docker-compose.prod.yml")
"${staged_compose[@]}" config -q
"${staged_compose[@]}" build api frontend
# 운영 DB 환경을 전달하지 않는 독립 컨테이너에서 Linux 테스트를 수행한다.
docker run --rm -v "$incoming/backend/tests:/app/tests:ro" nutri-kids-production-api python -m pytest -q

activated=1
rsync -a --exclude=.env.production --exclude=deploy-data/ "$incoming/" "$production/"
install -m 600 "$incoming/.env.production" "$production/.env.production"
"${compose[@]}" up -d --no-deps --wait --wait-timeout 180 api frontend
curl --fail --silent --show-error --retry 8 --retry-delay 2 --retry-all-errors \
  https://nutri.cora1022.com/api/v1/health
curl --fail --silent --show-error https://nutri.cora1022.com/api/v1/auth/config
"${compose[@]}" ps
python3 -c 'import pathlib, sys; pathlib.Path(sys.argv[1]).unlink()' "$incoming/.env.production"
printf '\nDEPLOYMENT_OK\nBACKUP=%s\nRELEASE=%s\n' "$backup" "$release_root"
