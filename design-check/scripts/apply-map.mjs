#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deltaE, pxOf, allowedColors, hexToLab } from './lib/tokens.mjs';

const root = process.argv[2] || process.cwd();
const tokens = JSON.parse(readFileSync(join(root, '.design', 'tokens.json'), 'utf8'));
const report = JSON.parse(readFileSync(join(root, '.design', 'check-report.json'), 'utf8'));

const ALLOWED = allowedColors(tokens);
const radii = [tokens.radius.base, tokens.radius.card].map(pxOf);

const CHROMA_THRESHOLD = 20;                        // Lab a/b 반경 — 이 이상은 유채색으로 판정
const chroma = hex => { const l = hexToLab(hex); return Math.hypot(l.a, l.b); };

function proposal(v) {
  if (v.rule === 'color-not-allowed') {
    const hex = v.actual.startsWith('#') ? v.actual : null;
    if (!hex) return null;                          // rgb() 리터럴은 수동 확인
    // 유채색 위반은 회색·흰색 등 무채색 팔레트로 탈색시키지 않도록 유채색 팔레트로 후보 제한
    const chromatic = ALLOWED.filter(a => chroma(a) >= CHROMA_THRESHOLD);
    const candidates = chroma(hex) >= CHROMA_THRESHOLD && chromatic.length ? chromatic : ALLOWED;
    let best = candidates[0], bd = Infinity;
    for (const a of candidates) { const d = deltaE(a, hex); if (d < bd) { bd = d; best = a; } }
    return { to: best };
  }
  if (v.rule === 'radius-off-scale') {
    const px = pxOf(v.actual);
    const near = radii.reduce((a, b) => Math.abs(b - px) < Math.abs(a - px) ? b : a);
    return { to: `${near}px` };
  }
  if (v.rule === 'font-family-mismatch')
    return { to: `'${tokens.font.family}', ${v.actual.includes('serif') && !v.actual.includes('sans') ? 'serif' : 'sans-serif'}` };
  return null;
}

const byFile = new Map(), skipped = [];
for (const v of report.violations) {
  if (!v.file) { skipped.push({ ...v, reason: '실측 위반 — selector 기반 수동 확인' }); continue; }
  const p = proposal(v);
  if (!p) { skipped.push({ ...v, reason: '자동 치환 불가(형식) — 수동 확인' }); continue; }
  if (!byFile.has(v.file)) byFile.set(v.file, []);
  byFile.get(v.file).push({ line: v.line, from: v.actual, to: p.to, rule: v.rule });
}
console.log(JSON.stringify({
  plan: [...byFile].map(([file, edits]) => ({ file, edits })),
  skipped,
}, null, 2));
