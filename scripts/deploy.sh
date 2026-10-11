#!/usr/bin/env bash
# deploy.sh – buddy-shelf auf Unraid aktualisieren (Ablauf wie SeestarManager).
#
#   scripts/deploy.sh            # deployt den aktuellen Commit (muss auf main gepusht sein)
#
# 1. wartet, bis CI für den Commit grün ist (CI baut :latest und :<sha> aus EINEM Build)
# 2. POST /api/admin/self-recreate (Token aus BUDDY_SHELF_ADMIN_TOKEN, unter Windows aus der Benutzer-Variable)
# 3. pollt /healthz, bis die neue sha läuft – erst dann ist der Code wirklich live
set -euo pipefail

PROD="${BUDDY_SHELF_PROD_URL:-http://100.101.172.117:8096}"
TOKEN="${BUDDY_SHELF_ADMIN_TOKEN:-}"
if [ -z "$TOKEN" ] && command -v powershell >/dev/null; then
  TOKEN="$(powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('BUDDY_SHELF_ADMIN_TOKEN','User')" | tr -d '\r')"
fi
[ -n "$TOKEN" ] || { echo "BUDDY_SHELF_ADMIN_TOKEN fehlt"; exit 1; }

SHA="$(git rev-parse HEAD)"
[ "$(git rev-parse origin/main 2>/dev/null)" = "$SHA" ] || { echo "HEAD ist nicht origin/main – erst pushen/mergen"; exit 1; }

echo "==> warte auf CI für ${SHA:0:7} …"
# GitHub legt den Lauf erst einige Sekunden nach dem Push an
for _ in $(seq 1 20); do
  RUN_ID="$(gh run list --commit "$SHA" --workflow CI --json databaseId --jq '.[0].databaseId')"
  [ -n "$RUN_ID" ] && break
  sleep 5
done
[ -n "$RUN_ID" ] || { echo "kein CI-Lauf für $SHA gefunden"; exit 1; }
gh run watch "$RUN_ID" --exit-status > /dev/null || { echo "CI fehlgeschlagen"; exit 1; }

LIVE="$(curl -s --max-time 6 "$PROD/healthz" | sed -n 's/.*"sha":"\([a-f0-9]*\)".*/\1/p')"
[ "$LIVE" = "$SHA" ] && { echo "✓ ${SHA:0:7} läuft bereits"; exit 0; }

echo "==> recreate (läuft: ${LIVE:0:7}) …"
curl -s --max-time 120 -X POST "$PROD/api/admin/self-recreate" -H "Authorization: Bearer $TOKEN" | grep -oE '"(recreating|error)":[^,}]*' || true

echo "==> warte auf ${SHA:0:7} …"
for i in $(seq 1 40); do
  sleep 6
  LIVE="$(curl -s --max-time 6 "$PROD/healthz" | sed -n 's/.*"sha":"\([a-f0-9]*\)".*/\1/p' || true)"
  if [ "$LIVE" = "$SHA" ]; then echo "✓ live: ${SHA:0:7}"; exit 0; fi
  echo "   [$i] läuft: ${LIVE:0:7}"
done
echo "!! ${SHA:0:7} nach 4 min nicht live – Container in Unraid prüfen (docker logs buddy-shelf)"
exit 1
