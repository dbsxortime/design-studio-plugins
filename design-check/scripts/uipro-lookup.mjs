#!/usr/bin/env node
// uipro-lookup — ui-ux-pro-max 반입 데이터(design-check/data/uipro)를 키워드로 조회.
// 사용: node uipro-lookup.mjs "<english keywords>" [--json]
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'uipro');

function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length > 2).map(r =>
    Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || '').trim()])));
}
const load = f => parseCSV(readFileSync(join(DATA, f), 'utf8'));

function score(query, text) {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1);
  const t = text.toLowerCase();
  let s = 0;
  for (const w of words) {
    if (new RegExp(`\\b${w}\\b`).test(t)) s += 2;
    else if (t.includes(w)) s += 1;
  }
  return s;
}
function best(rows, query, cols) {
  let top = rows[0], topS = -1;
  for (const r of rows) {
    const s = score(query, cols.map(c => r[c] || '').join(' '));
    if (s > topS) { topS = s; top = r; }
  }
  return top;
}

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const query = args.filter(a => a !== '--json').join(' ');
if (!query) { console.error('usage: uipro-lookup.mjs "<english keywords>" [--json]'); process.exit(1); }

const colors = best(load('colors.csv'), query, ['Product Type', 'Notes']);
const reasoning = best(load('ui-reasoning.csv'), query, ['UI_Category', 'Recommended_Pattern', 'Color_Mood']);
const styles = load('styles.csv');
// 스타일: 판단 규칙의 Style_Priority 첫 항목과 이름이 맞는 행 우선, 없으면 쿼리 매칭
const priName = (reasoning['Style_Priority'] || '').split('+')[0].trim();
const style = styles.find(s => priName && s['Style Category'].toLowerCase().includes(priName.toLowerCase()))
  || best(styles, query, ['Style Category', 'Keywords', 'Best For']);
const landingRow = best(load('landing.csv'), `${reasoning['Recommended_Pattern']} ${query}`, ['Pattern Name', 'Keywords']);

const out = {
  query,
  colors: {
    productType: colors['Product Type'], primary: colors['Primary'], onPrimary: colors['On Primary'],
    secondary: colors['Secondary'], accent: colors['Accent'], background: colors['Background'],
    foreground: colors['Foreground'], card: colors['Card'], muted: colors['Muted'],
    border: colors['Border'], destructive: colors['Destructive'], ring: colors['Ring'], notes: colors['Notes'],
  },
  reasoning: {
    category: reasoning['UI_Category'], pattern: reasoning['Recommended_Pattern'],
    stylePriority: reasoning['Style_Priority'], colorMood: reasoning['Color_Mood'],
    keyEffects: reasoning['Key_Effects'], antiPatterns: reasoning['Anti_Patterns'], severity: reasoning['Severity'],
  },
  style: {
    name: style['Style Category'], keywords: style['Keywords'], effects: style['Effects & Animation'],
    bestFor: style['Best For'], avoidFor: style['Do Not Use For'],
  },
  landing: landingRow ? {
    name: landingRow['Pattern Name'], sections: landingRow['Section Order'],
    cta: landingRow['Primary CTA Placement'], colorStrategy: landingRow['Color Strategy'],
    effects: landingRow['Recommended Effects'],
  } : null,
};

if (asJson) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`[${out.colors.productType}] ${out.style.name}`);
  console.log(`primary ${out.colors.primary} · bg ${out.colors.background} · accent ${out.colors.accent} — ${out.colors.notes}`);
  console.log(`패턴: ${out.reasoning.pattern} / 피할 것: ${out.reasoning.antiPatterns}`);
}
