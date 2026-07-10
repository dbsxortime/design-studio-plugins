import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';

test('extract-static: 색·radius·폰트 수집', () => {
  const out = JSON.parse(execFileSync('node',
    ['design-check/scripts/extract-static.mjs', 'tests/fixture'], { encoding: 'utf8' }));
  const vals = out.findings.map(f => f.value);
  assert.ok(vals.includes('#ff0000'));
  assert.ok(vals.includes('#e74c3c'));
  assert.ok(vals.includes('#0046ff') || vals.includes('#0046FF'));
  assert.ok(vals.includes('rgb(0, 70, 255)'));
  assert.ok(out.findings.some(f => f.kind === 'radius' && f.value === '3px'));
  assert.ok(out.findings.some(f => f.kind === 'font' && /comic sans/i.test(f.value)));
  assert.ok(out.findings.every(f => f.file && f.line > 0));
});
