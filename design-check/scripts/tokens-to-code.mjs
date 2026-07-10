#!/usr/bin/env node
/* tokens.json → 코드 결정적 변환기 — 확정 기준을 손으로 옮겨 적다 생기는 값 손실 방지.
   사용: node tokens-to-code.mjs <프로젝트> [--format css|tailwind|all]
   출력: <프로젝트>/.design/tokens.css (css) · tokens.tailwind.css (tailwind, v4 @theme)
   출력물은 타임스탬프 없이 결정적 — 재실행 diff 무변경으로 무손실 검증 가능. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateTokens, expandHex, contrastOn } from './lib/tokens.mjs';

const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith('--')) || '.';
const fi = args.indexOf('--format');
const format = fi >= 0 ? args[fi + 1] : 'css';
if (!['css', 'tailwind', 'all'].includes(format)) {
  console.error('--format은 css | tailwind | all 중 하나'); process.exit(1);
}

let tokens;
try {
  tokens = JSON.parse(readFileSync(join(dir, '.design', 'tokens.json'), 'utf8'));
} catch (e) {
  console.error(`.design/tokens.json 읽기 실패: ${e.message} — /design-tokens로 기준부터 확보`);
  process.exit(1);
}
const v = validateTokens(tokens);
if (!v.ok) { console.error('tokens.json 검증 실패:\n- ' + v.errors.join('\n- ')); process.exit(1); }

/* 무손실 보증 — validateTokens는 bg/surface/text/muted를 optional로 두지만,
   코드 생성 시 누락은 빈 CSS 변수(조용한 손실)가 되므로 여기서는 필수로 강제 */
const missing = ['bg', 'surface', 'text', 'muted'].filter(k => !tokens.color[k]);
if (missing.length) {
  console.error(`color.${missing.join(', color.')} 누락 — 빈 변수를 만들지 않기 위해 중단. /design-tokens로 채운 뒤 재실행`);
  process.exit(1);
}

/* font.family가 스택이 아니면 따옴표 감싸고 sans-serif 폴백 추가 */
function fontStack(family) {
  const f = String(family).trim();
  if (f.includes(',')) return f;                        // 이미 스택
  const quoted = /^['"]/.test(f) ? f : `'${f}'`;
  return `${quoted}, sans-serif`;
}

const onPrimary = tokens.color.onPrimary
  ? expandHex(tokens.color.onPrimary) : contrastOn(tokens.color.primary);

/* 변수 이름은 Tailwind v4 @theme 네임스페이스와 호환 —
   css/tailwind 두 포맷이 같은 이름을 써서 프레임워크 전환 시에도 코드 수정 최소화 */
const vars = [
  ['--color-primary', expandHex(tokens.color.primary)],
  ['--color-on-primary', onPrimary],
  ['--color-bg', expandHex(tokens.color.bg)],
  ['--color-surface', expandHex(tokens.color.surface)],
  ['--color-text', expandHex(tokens.color.text)],
  ['--color-muted', expandHex(tokens.color.muted)],
  ...(tokens.color.allowed || []).map((c, i) => [`--color-allowed-${i + 1}`, expandHex(c)]),
  ['--font-sans', fontStack(tokens.font.family)],
  ['--font-weight-heading', String(tokens.font.headingWeight ?? 700)],
  ['--text-body', tokens.font.bodySize || '14px'],
  ['--radius-base', tokens.radius.base],
  ['--radius-card', tokens.radius.card || tokens.radius.base],
  ['--radius-pill', tokens.radius.pill || '999px'],
  ['--spacing-unit', tokens.spacing.unit],
  ['--spacing-gutter', tokens.spacing.gutter || '16px'],
];

function render(wrapper) {
  const head = `/* AUTO-GENERATED — .design/tokens.json (design-studio/tokens-v1)에서 생성.
   손으로 수정 금지. 재생성: node <design-check-root>/scripts/tokens-to-code.mjs <프로젝트> --format ${wrapper === '@theme' ? 'tailwind' : 'css'}
   project: ${tokens.meta?.project || '-'} · tokens updated: ${tokens.meta?.updated || '-'} */\n`;
  const body = vars.map(([k, val]) => `  ${k}: ${val};`).join('\n');
  return `${head}${wrapper === '@theme' ? '@theme' : ':root'} {\n${body}\n}\n`;
}

mkdirSync(join(dir, '.design'), { recursive: true });
const written = [];
if (format === 'css' || format === 'all') {
  const p = join(dir, '.design', 'tokens.css');
  writeFileSync(p, render(':root')); written.push(p);
}
if (format === 'tailwind' || format === 'all') {
  const p = join(dir, '.design', 'tokens.tailwind.css');
  writeFileSync(p, render('@theme')); written.push(p);
}
console.log(JSON.stringify({
  written, vars: vars.length,
  onPrimary: { value: onPrimary, auto: !tokens.color.onPrimary },
}, null, 2));
