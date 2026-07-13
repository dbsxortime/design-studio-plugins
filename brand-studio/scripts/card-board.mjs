#!/usr/bin/env node
/* 명함 갤러리 조립.
   node card-board.mjs <프로젝트> --gallery [--recommend 1-2,3-4,…]
     → .design/card/gallery.html — 채택 69종 전 슬롯을 프로젝트 토큰·정보로 재스킨
   외부 요청 0, 산출 결정적(타임스탬프·난수 금지) — 스타일은 shell 인라인 CSS. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveCardTokens, fillSlots, loadCardState } from './lib/card.mjs';

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
} else {
  console.error(`알 수 없는 모드: ${mode}`);
  process.exit(1);
}
