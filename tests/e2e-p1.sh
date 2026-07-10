#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d); SRV=""
trap 'rm -rf "$TMP"; kill $SRV 2>/dev/null || true' EXIT
mkdir -p "$TMP/.design"
FIXTURE_TOKENS="$TMP/.design/tokens.json"
cat > "$FIXTURE_TOKENS" <<'EOF'
{"$schema":"design-studio/tokens-v1",
 "meta":{"project":"e2e","updated":"2026-07-10","source":"onboarding"},
 "color":{"primary":"#0046FF","bg":"#ffffff","surface":"#f4f5f7","text":"#111111","muted":"#777777","allowed":[]},
 "font":{"family":"Pretendard","headingWeight":800,"bodySize":"14px"},
 "radius":{"base":"10px","card":"14px","pill":"999px"},
 "spacing":{"unit":"4px","gutter":"16px"},
 "tolerance":{"colorDeltaE":5,"radiusPx":2}}
EOF

# 기동 전 포트 점유 확인 — 이미 응답이 있으면 외부 서버를 대상으로 검증할 위험이 있어 중단
if curl -s -m 1 http://localhost:28572/health >/dev/null 2>&1; then
  echo "포트 28572 사용 중 — 기존 프로세스 종료 후 재실행하세요" >&2
  exit 1
fi

node design-studio/scripts/studio-serve.mjs --tokens "$FIXTURE_TOKENS" --no-open & SRV=$!
for i in $(seq 1 40); do curl -sf http://localhost:28572/health >/dev/null && break; sleep 0.25; done
curl -sf http://localhost:28572/ > "$TMP/index.html"
grep -q '__USER_TOKENS__' "$TMP/index.html" && echo "PASS inject"
curl -sf http://localhost:28572/export.json > "$TMP/export.json"
grep -q '"id"' "$TMP/export.json" && echo "PASS export"

# 안전망: 기동 직전 체크와 실제 기동 사이 레이스로 외부 인스턴스가 재사용됐을 가능성 방어
EXPORTED_TOKENS_PATH=$(grep -o '"tokensPath":"[^"]*"' "$TMP/export.json" | sed 's/^"tokensPath":"//;s/"$//')
if [ "$EXPORTED_TOKENS_PATH" != "$FIXTURE_TOKENS" ]; then
  echo "외부 인스턴스 재사용 감지 — tokensPath 불일치 (got: $EXPORTED_TOKENS_PATH)" >&2
  exit 1
fi

curl -sf -X POST http://localhost:28572/save-tokens -H 'Content-Type: application/json' \
  -d @"$FIXTURE_TOKENS" >/dev/null && echo "PASS save"
node design-studio/scripts/motion-lab.mjs get shimmer-button | grep -q shimmer && echo "PASS cli"
echo "E2E P1 OK"
