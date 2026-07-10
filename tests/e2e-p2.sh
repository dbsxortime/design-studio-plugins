#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --test tests/tokens.test.mjs tests/extract.test.mjs tests/report.test.mjs
# 클린 픽스처: 위반 소스 제거 시 위반 0 확인
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/src" "$TMP/.design"
cp tests/fixture/.design/tokens.json "$TMP/.design/"
cat > "$TMP/src/clean.css" <<'EOF'
.btn { background: #0046FF; border-radius: 10px; font-family: 'Pretendard', sans-serif; }
EOF
node design-check/scripts/check-report.mjs "$TMP" | grep -q '위반 없음' && echo "PASS clean"
echo "E2E P2 OK"
