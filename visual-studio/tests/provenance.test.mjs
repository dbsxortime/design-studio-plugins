import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordGeneration, readProvenance } from '../scripts/lib/provenance.mjs';

test('recordGeneration: append + id 부여 + 재읽기', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vt-'));
  try {
    const r1 = recordGeneration(dir, { prompt: 'a', model: 'flux', seed: 1 });
    const r2 = recordGeneration(dir, { prompt: 'b', model: 'flux', seed: 2 });
    assert.equal(typeof r1.id, 'string');
    assert.notEqual(r1.id, r2.id);
    const all = readProvenance(dir);
    assert.equal(all.length, 2);
    assert.equal(all[0].prompt, 'a');
    assert.equal(all[1].seed, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('readProvenance: 파일 없으면 빈 배열', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vt-'));
  try { assert.deepEqual(readProvenance(dir), []); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});
