#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { validateTokens, deltaE, pxOf, allowedColors, expandHex } from './lib/tokens.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] || process.cwd();
const args = process.argv.slice(3);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

const tokens = JSON.parse(readFileSync(join(root, '.design', 'tokens.json'), 'utf8'));
const v = validateTokens(tokens);
if (!v.ok) { console.error('tokens.json 스키마 오류:\n- ' + v.errors.join('\n- ')
  + '\n→ /design-tokens init 재실행을 권장'); process.exit(1); }

const findings = opt('--findings')
  ? JSON.parse(readFileSync(opt('--findings'), 'utf8')).findings
  : JSON.parse(execFileSync('node',
      [resolve(HERE, 'extract-static.mjs'), root], { encoding: 'utf8', maxBuffer: 64e6 })).findings;
const live = opt('--live')
  ? JSON.parse(readFileSync(opt('--live'), 'utf8')).findings : [];

const ALLOWED = allowedColors(tokens);
const tolE = tokens.tolerance?.colorDeltaE ?? 5;
const tolPx = tokens.tolerance?.radiusPx ?? 2;
const radiusOk = px => [tokens.radius.base, tokens.radius.card, tokens.radius.pill]
  .some(r => Math.abs(pxOf(r) - px) <= tolPx) || px === 0 || px >= 999;
const famOk = f => f.toLowerCase().includes(tokens.font.family.toLowerCase())
  || /system-ui|sans-serif|serif|monospace|inherit|var\(/.test(f);

function toHex(val) {           // rgb() → hex. 알파<1(반투명)과 hsl은 판단 보류(null)
  const m = val.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?/);
  if (m) {
    if (m[4] !== undefined && parseFloat(m[4]) < 1) return null;  // 반투명은 팔레트 색이 아님
    return '#' + [m[1], m[2], m[3]]
      .map(n => (+n).toString(16).padStart(2, '0')).join('');
  }
  if (val.startsWith('#')) return expandHex(val);
  return null;
}

const violations = [];
for (const f of [...findings, ...live]) {
  if (f.kind === 'color') {
    const hex = toHex(f.value);
    if (!hex) continue;                       // hsl·var 등은 판단 보류
    const near = ALLOWED.some(a => deltaE(a, hex) <= tolE);
    if (!near) violations.push({ rule: 'color-not-allowed', severity: 'high',
      expected: `팔레트(${ALLOWED.join(', ')}) ±ΔE${tolE}`, actual: f.value,
      file: f.file, line: f.line, selector: f.selector, context: f.context });
  } else if (f.kind === 'radius') {
    const px = pxOf(f.value);
    if (px > 0 && !radiusOk(px)) violations.push({ rule: 'radius-off-scale',
      severity: 'med', expected: `${tokens.radius.base}/${tokens.radius.card}/pill ±${tolPx}px`,
      actual: f.value, file: f.file, line: f.line, selector: f.selector, context: f.context });
  } else if (f.kind === 'font') {
    if (!famOk(f.value)) violations.push({ rule: 'font-family-mismatch',
      severity: 'low', expected: tokens.font.family, actual: f.value,
      file: f.file, line: f.line, selector: f.selector, context: f.context });
  }
}

const summary = { high: 0, med: 0, low: 0 };
violations.forEach(x => summary[x.severity]++);
mkdirSync(join(root, '.design'), { recursive: true });
writeFileSync(join(root, '.design', 'check-report.json'),
  JSON.stringify({ generated: new Date().toISOString(), tokens: tokens.meta,
    liveIncluded: live.length > 0, summary, violations }, null, 2));

const md = [`# 디자인 기준 점검 리포트`,
  `- 기준: .design/tokens.json (primary ${tokens.color.primary})`,
  `- 실측 포함: ${live.length > 0 ? '예' : '아니오(정적만)'}`,
  `- 위반: high ${summary.high} · med ${summary.med} · low ${summary.low}`, '',
  ...violations.map(x =>
    `- [${x.severity}] ${x.rule} — \`${x.actual}\` (기대: ${x.expected})` +
    (x.file ? ` @ ${x.file}:${x.line}` : '') + (x.selector ? ` [${x.selector}]` : '')),
  '', violations.length ? '수정 적용: /design-apply' : '✅ 위반 없음'].join('\n');
writeFileSync(join(root, '.design', 'check-report.md'), md);
console.log(md);
