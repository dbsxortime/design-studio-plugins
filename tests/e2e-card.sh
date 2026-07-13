#!/bin/bash
# /card 파이프라인 e2e: fixture 프로젝트로 gallery → variants → print
set -euo pipefail
cd "$(dirname "$0")/.."
D=$(mktemp -d)
trap 'rm -rf "$D"' EXIT
mkdir -p "$D/.design"
cat > "$D/.design/tokens.json" <<'JSON'
{"$schema":"design-studio/tokens-v1","meta":{"project":"e2e"},
 "color":{"primary":"#0B6E4F","onPrimary":"#FFFFFF","bg":"#ffffff","surface":"#f2f6f4","text":"#14211c","muted":"#5f6f68"},
 "font":{"family":"Pretendard","headingWeight":800,"bodySize":"14px"},
 "radius":{"base":"10px","card":"14px","pill":"999px"}}
JSON
cat > "$D/.design/card.json" <<'JSON'
{"$schema":"brand-studio/card-v1","info":{"name":"김철수","role":"Designer","org":"acme","domain":"acme.io","phone":"010-1234-5678","email":"kim@acme.io","slogan1":"Small","slogan2":"Big","copy":"카피"},"picks":[],"rounds":[],"final":null,"exports":[]}
JSON
node brand-studio/scripts/card-board.mjs "$D" --gallery --recommend 1-1,3-1 | grep -q gallery.html
node brand-studio/scripts/card-board.mjs "$D" --variants --pick 1-1,3-1 | grep -q variants-v1
node - <<EOF
const fs=require('fs');const p='$D/.design/card.json';
const s=JSON.parse(fs.readFileSync(p));s.final='1-1';fs.writeFileSync(p,JSON.stringify(s));
EOF
node brand-studio/scripts/card-board.mjs "$D" --print | grep -q print.html
grep -q '@page { size: 94mm 54mm' "$D/.design/card/print.html"
echo "e2e-card PASS"
