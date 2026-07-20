#!/usr/bin/env node
/* CLI: <project> --intent "<...>" --use <og|hero|square|story>
   프로젝트 .design에서 tokens/brand 읽어 스캐폴드 JSON 출력. jobslab self 차단. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildScaffold } from './lib/prompt-brand.mjs';

const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith('--')) || '.';
const get = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };

const tokens = JSON.parse(readFileSync(join(dir, '.design', 'tokens.json'), 'utf8'));
let brand = {};
try { brand = JSON.parse(readFileSync(join(dir, '.design', 'brand.json'), 'utf8')); } catch {}

if ((brand.meta?.project || tokens.meta?.project) === 'jobslab') {
  console.error('차단: visual-studio는 클라이언트 전용. jobslab 자체 브랜드는 이미지 최소 원칙.');
  process.exit(2);
}

const scaffold = buildScaffold({
  tokens, brand,
  intent: get('intent', ''),
  use: get('use', 'hero'),
});
console.log(JSON.stringify(scaffold, null, 2));
