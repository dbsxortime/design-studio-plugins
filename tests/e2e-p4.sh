#!/bin/bash
# brand-studio 전 파이프라인 E2E (대화 게이트 제외):
# 데모 브랜드 → asset-expand → 캡처 PNG 배치 → pack-ico → verify → brandbook → og-render → 결정성
set -euo pipefail
cd "$(dirname "$0")/.."

STEP=0; STEP_DESC=""
step() { STEP="$1"; STEP_DESC="$2"; }
die() { echo "e2e-p4 FAIL — 단계 ${STEP}(${STEP_DESC}): $1" >&2; exit 1; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
# node 등 외부 명령이 nonzero로 죽는 경우(명시적 die 호출 없이)도 같은 형식으로 단계 표시
trap 'die "명령 실패(exit $?)"' ERR

BRAND_DIR="$TMP/.design/brand"

step 1 "임시 데모 프로젝트 생성"
mkdir -p "$TMP/.design/brand/logo"
cat > "$TMP/.design/tokens.json" <<'EOF'
{"$schema":"design-studio/tokens-v1",
 "meta":{"project":"e2e-p4","updated":"2026-07-12","source":"onboarding"},
 "color":{"primary":"#0046FF","onPrimary":"#FFFFFF","bg":"#ffffff","surface":"#f4f5f7","text":"#111111","muted":"#777777"},
 "font":{"family":"Pretendard","headingWeight":800,"bodySize":"14px"},
 "radius":{"base":"10px","card":"14px","pill":"999px"},
 "spacing":{"unit":"4px","gutter":"16px"},
 "tolerance":{"colorDeltaE":5,"radiusPx":2}}
EOF
cat > "$TMP/.design/brand.json" <<'EOF'
{"$schema":"brand-studio/brand-v1",
 "meta":{"project":"E2E 데모 브랜드","updated":"2026-07-12"},
 "brief":{"keywords":["modern","friendly","bold"]},
 "decisions":{"logoType":"wordmark"},
 "logo":{"svg":".design/brand/logo/logo.svg","variants":["horizontal-color","symbol-mono"],"clearspace":"0.5x","minSizePx":24},
 "graphics":{"patterns":["pattern-a.svg"],"shapes":["shape-1.svg"],"motifNote":"circles and arcs"},
 "motion":{"logoAnim":"fade","reducedFallback":true},
 "assets":{"favicon":{"simplified":true},"details":[{"id":"scrollbar","enabled":false}]},
 "applications":{"og":{"slogan":"리듬을 만나다"}},
 "progress":{"phase":"final"}}
EOF
cat > "$TMP/.design/brand/logo/logo.svg" <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#0046FF"/></svg>
EOF

step 2 "asset-expand 기본 모드 — _capture.html·icons 즉시 산출물"
node brand-studio/scripts/asset-expand.mjs "$TMP" > "$TMP/expand1.json"
[ -s "$BRAND_DIR/_capture.html" ] || die "_capture.html 미생성"
[ -f "$BRAND_DIR/icons/favicon.svg" ] || die "icons/favicon.svg 미생성"
[ -f "$BRAND_DIR/icons/safari-pinned-tab.svg" ] || die "safari-pinned-tab.svg 미생성"
[ -f "$BRAND_DIR/icons/manifest.webmanifest" ] || die "manifest.webmanifest 미생성"
echo "PASS asset-expand"

step 3 "캡처 대역 — captures 목록대로 치수 맞는 PNG 합성 배치(외부 도구 없이 node로 IHDR만 채운 최소 PNG)"
node -e '
const fs = require("node:fs");
const path = require("node:path");
const [dir, jsonPath] = process.argv.slice(1);
const { captures } = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
function fakePng(w, h) {
  const buf = Buffer.alloc(33);
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  buf.write("IHDR", 12);
  buf.writeUInt32BE(w, 16);
  buf.writeUInt32BE(h, 20);
  return buf;
}
if (captures.length === 0) throw new Error("captures 목록 비어있음");
for (const c of captures) {
  const target = path.join(dir, ".design", "brand", c.target);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, fakePng(c.size.w, c.size.h));
}
' "$TMP" "$TMP/expand1.json"
echo "PASS captures"

step 4 "--pack-ico — favicon.ico 패킹"
node brand-studio/scripts/asset-expand.mjs "$TMP" --pack-ico > "$TMP/pack-ico.json"
[ -s "$BRAND_DIR/icons/favicon.ico" ] || die "favicon.ico 미생성/비어있음"
echo "PASS pack-ico"

step 5 "--verify — 산출물 치수 검증"
node brand-studio/scripts/asset-expand.mjs "$TMP" --verify > "$TMP/verify.json"
echo "PASS verify"

step 6 "brand-board --brandbook — 브랜드북 생성"
node brand-studio/scripts/brand-board.mjs "$TMP" --brandbook > /dev/null
[ -s "$BRAND_DIR/brandbook.html" ] || die "brandbook.html 미생성"
grep -q '<h2>로고 시스템</h2>' "$BRAND_DIR/brandbook.html" || die "'로고 시스템' 헤딩 없음"
echo "PASS brandbook"

step 7 "og-render — 조판 픽스처 치환"
cat > "$BRAND_DIR/og-template.html" <<'EOF'
<div class="og-card" style="width:1200px;height:630px;background:#0046FF;color:#ffffff">
  <h1 class="og-title">{{TITLE}}</h1>
  <p class="og-slogan">{{SLOGAN}}</p>
</div>
EOF
node brand-studio/scripts/og-render.mjs "$TMP" --title "테스트 글" > "$TMP/og1.json"
grep -q '테스트 글' "$BRAND_DIR/_og-capture.html" || die "og 캡처에 치환된 제목 없음"
echo "PASS og-render"

step 8 "결정성 — 동일 인자 재실행 시 SVG/CSS/HTML/webmanifest 산출물 diff 없음(PNG 제외)"
snapshot() { for f in "$@"; do cp "$f" "$f.snap"; done; }
DET_FILES=(
  "$BRAND_DIR/_capture.html"
  "$BRAND_DIR/icons/favicon.svg"
  "$BRAND_DIR/icons/safari-pinned-tab.svg"
  "$BRAND_DIR/icons/manifest.webmanifest"
  "$BRAND_DIR/brandbook.html"
  "$BRAND_DIR/_og-capture.html"
)
snapshot "${DET_FILES[@]}"
node brand-studio/scripts/asset-expand.mjs "$TMP" > /dev/null
node brand-studio/scripts/brand-board.mjs "$TMP" --brandbook > /dev/null
node brand-studio/scripts/og-render.mjs "$TMP" --title "테스트 글" > /dev/null
for f in "${DET_FILES[@]}"; do
  diff -q "$f.snap" "$f" >/dev/null || die "결정성 위반: $f 재실행 시 변경됨"
done
echo "PASS determinism"

echo "e2e-p4 PASS"
