import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';

const run = a => execFileSync('node', ['design-check/scripts/uipro-lookup.mjs', ...a], { encoding: 'utf8' });

test('uipro-lookup: 업종별로 다른 시스템이 나온다', () => {
  const yoga = JSON.parse(run(['yoga wellness booking', '--json']));
  const fin = JSON.parse(run(['fintech payment trust', '--json']));
  assert.match(yoga.colors.primary, /^#[0-9A-Fa-f]{6}$/);
  assert.match(fin.colors.primary, /^#[0-9A-Fa-f]{6}$/);
  assert.notEqual(yoga.colors.primary, fin.colors.primary);
  assert.ok(yoga.style.name && fin.style.name);
  assert.ok(yoga.reasoning.antiPatterns.length > 0);
});

test('uipro-lookup: 데이터 무결성', () => {
  const out = JSON.parse(run(['saas dashboard', '--json']));
  for (const k of ['primary','background','foreground']) assert.ok(out.colors[k], `colors.${k} 누락`);
  assert.ok(out.reasoning.pattern, 'reasoning.pattern 누락');
});
