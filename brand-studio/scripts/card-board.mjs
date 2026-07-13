#!/usr/bin/env node
/* 명함 갤러리 조립.
   node card-board.mjs <프로젝트> --gallery [--recommend 1-2,3-4,…]
     → .design/card/gallery.html — 채택 69종 전 슬롯을 프로젝트 토큰·정보로 재스킨
   node card-board.mjs <프로젝트> --variants --pick 3-1,6-2 [--round 2] [--compare] [--label "V2"]
     → .design/card/variants-v{round}.html — 선택 시안만 확대 비교 보드로 조립
   외부 요청 0, 산출 결정적(타임스탬프·난수 금지) — 스타일은 shell 인라인 CSS. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveCardTokens, fillSlots, loadCardState, saveCardState } from './lib/card.mjs';

const TPL_DIR = join(dirname(fileURLToPath(import.meta.url)), '../references/card-templates');
const [projectDir, mode, ...rest] = process.argv.slice(2);
if (!projectDir || !mode) {
  console.error('사용법: card-board.mjs <프로젝트> --gallery [--recommend ids]');
  process.exit(1);
}
const arg = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : null; };
const tokens = JSON.parse(readFileSync(join(projectDir, '.design/tokens.json'), 'utf8'));
const state = loadCardState(projectDir);
const outDir = join(projectDir, '.design/card');
mkdirSync(outDir, { recursive: true });

function shellWithTokens() {
  let shell = readFileSync(join(TPL_DIR, '_shell-head.html'), 'utf8');
  const t = deriveCardTokens(tokens);
  // 마커 블록 밖 캡션에도 기본 primary 헥스가 프로즈로 박제돼 있음 — 교체 전에 뽑아둠
  const oldPrimaryMatch = shell.match(/--c-primary:(#[0-9A-Fa-f]{6})/);
  shell = shell.replace(/\/\*CARD-TOKENS-START\*\/[\s\S]*?\/\*CARD-TOKENS-END\*\//, () => {
    const lines = Object.entries(t).map(([k, v]) => `  ${k}:${v};`).join('\n');
    return `/*CARD-TOKENS-START*/\n:root{\n${lines}\n  --f-sans:'${tokens.font.family}',-apple-system,sans-serif;\n  --f-disp:var(--f-sans);--f-serif:Georgia,serif;--f-mono:ui-monospace,Menlo,monospace;\n}\n/*CARD-TOKENS-END*/`;
  });
  if (oldPrimaryMatch) shell = shell.replaceAll(oldPrimaryMatch[1], t['--c-primary']);
  // shell 자체(title·캡션)에도 {{org}}/{{name}} 슬롯이 있음 — frags와 동일하게 채움
  return fillSlots(shell, state.info || {});
}

function frags() {
  return [1, 2, 3, 4, 5, 6, 7].map(n => readFileSync(join(TPL_DIR, `frag-${n}.html`), 'utf8')).join('\n');
}

// 단일 카드(<div class="tpl" data-id="…">…</div>)만 균형 태그 카운팅으로 추출.
// 주의: 각 카드 앞에 <!-- 주석 -->이 끼어 있어 "다음 형제 카드/섹션 직전"을 룩어헤드로 잡는 방식은
// 룩어헤드가 즉시 실패해 다음 카드들까지 통째로 삼켜버린다(frag 마지막 카드는 반대로 .grid 닫는
// </div>까지 삼켜 빠져나온다) — 실측 확인됨. 깊이 카운팅으로 자기 자신의 닫는 태그에서 정확히 멈춘다.
function extractTpl(id) {
  for (let n = 1; n <= 7; n++) {
    const html = readFileSync(join(TPL_DIR, `frag-${n}.html`), 'utf8');
    const open = html.match(new RegExp(`<div class="tpl" data-id="${id}"[^>]*>`));
    if (!open) continue;
    const tagRe = /<div\b[^>]*>|<\/div>/g;
    tagRe.lastIndex = open.index + open[0].length;
    let depth = 1;
    let m;
    while ((m = tagRe.exec(html))) {
      depth += m[0] === '</div>' ? -1 : 1;
      if (depth === 0) return html.slice(open.index, tagRe.lastIndex);
    }
    throw new Error(`템플릿 ${id} 파싱 실패`);
  }
  throw new Error(`템플릿 ${id} 없음`);
}

if (mode === '--gallery') {
  const recommend = (arg('--recommend') || '').split(',').filter(Boolean);
  let body = fillSlots(frags(), state.info || {});
  for (const id of recommend) {
    body = body.replace(`data-id="${id}"`, `data-id="${id}" data-rec="1"`);
  }
  // 추천 배지: data-rec 카드의 tpl-head <b> 안 텍스트 앞에 ✨
  body = body.replace(/(data-rec="1"[\s\S]*?<b>)/g, '$1✨ ');
  const html = shellWithTokens() + body + '\n</body>\n</html>\n';
  const out = join(outDir, 'gallery.html');
  writeFileSync(out, html);
  console.log(JSON.stringify({ out, count: (body.match(/class="tpl" /g) || []).length }, null, 2));
} else if (mode === '--variants') {
  const picks = (arg('--pick') || '').split(',').filter(Boolean);
  if (!picks.length) { console.error('--pick 필수'); process.exit(1); }
  const round = Number(arg('--round') || 1);
  const compare = rest.includes('--compare');
  const label = arg('--label') || `V${round}`;
  const zoom = compare ? 2.4 : 1.6;
  const cards = picks.map((id, i) => {
    const tpl = fillSlots(extractTpl(id), state.info || {});
    return `<div class="vwrap"><div class="vlabel">V${round}${String.fromCharCode(97 + i)} · ${id}</div>${tpl}</div>`;
  }).join('\n');
  const html = shellWithTokens() +
    `<style>.vwrap{margin:0 0 40px}.vlabel{font:700 13px/1 var(--f-disp);letter-spacing:.1em;margin:0 0 10px;color:var(--c-primary)}.vwrap .tpl{zoom:${zoom}}</style>\n` +
    `<h2 style="font-family:var(--f-disp)">${label} — 시안 보드</h2>\n${cards}\n</body>\n</html>\n`;
  const out = join(outDir, `variants-v${round}.html`);
  writeFileSync(out, html);
  state.picks = [...new Set([...(state.picks || []), ...picks])];
  state.rounds = (state.rounds || []).filter(r => r.v !== round);
  state.rounds.push({ v: round, picks, label });
  state.rounds.sort((a, b) => a.v - b.v);
  saveCardState(projectDir, state);
  console.log(JSON.stringify({ out, picks, round }, null, 2));
} else {
  console.error(`알 수 없는 모드: ${mode}`);
  process.exit(1);
}
