/* 출처 기록 — assets/generated/_provenance.json 에 append. 순수 IO. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function file(projectDir) {
  return join(projectDir, 'assets', 'generated', '_provenance.json');
}

export function readProvenance(projectDir) {
  try { return JSON.parse(readFileSync(file(projectDir), 'utf8')); }
  catch { return []; }
}

/* id는 시간 함수 없이 결정적 — 기존 개수 기반 시퀀스 + 내용 해시 short */
function nextId(existing, entry) {
  const seq = String(existing.length + 1).padStart(4, '0');
  const basis = `${entry.model || ''}:${entry.seed ?? ''}:${entry.prompt || ''}`;
  let h = 0; for (const c of basis) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `gen-${seq}-${h.toString(36).slice(0, 6)}`;
}

export function recordGeneration(projectDir, entry) {
  const all = readProvenance(projectDir);
  const record = { id: nextId(all, entry), ...entry };
  all.push(record);
  mkdirSync(join(projectDir, 'assets', 'generated'), { recursive: true });
  writeFileSync(file(projectDir), JSON.stringify(all, null, 2));
  return record;
}
