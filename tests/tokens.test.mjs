import { test } from 'node:test';
import assert from 'node:assert';
import { validateTokens, deltaE, pxOf, allowedColors }
  from '../design-check/scripts/lib/tokens.mjs';

const good = { $schema: 'design-studio/tokens-v1',
  meta: { project: 'x', updated: '2026-07-10', source: 'onboarding' },
  color: { primary: '#0046FF', bg: '#fff', surface: '#f4f5f7', text: '#111', muted: '#777', allowed: ['#FF9F0A'] },
  font: { family: 'Pretendard', headingWeight: 800, bodySize: '14px' },
  radius: { base: '10px', card: '14px', pill: '999px' },
  spacing: { unit: '4px', gutter: '16px' },
  tolerance: { colorDeltaE: 5, radiusPx: 2 } };

test('validate', () => {
  assert.equal(validateTokens(good).ok, true);
  assert.equal(validateTokens({}).ok, false);
  assert.ok(validateTokens({ ...good, color: { primary: 'red' } }).errors.length > 0);
});
test('deltaE: 동일 0, 유사 작음, 상이 큼', () => {
  assert.equal(deltaE('#0046FF', '#0046FF'), 0);
  assert.ok(deltaE('#0046FF', '#0048FD') < 3);
  assert.ok(deltaE('#0046FF', '#FF0000') > 40);
});
test('pxOf / allowedColors', () => {
  assert.equal(pxOf('14px'), 14);
  assert.equal(pxOf('0.875rem'), 14);
  assert.ok(allowedColors(good).includes('#FF9F0A'));
  assert.ok(allowedColors(good).includes('#0046FF'));
});

test('contrastOn: 어두운 primary→흰 글자, 밝은 primary→진회색', async () => {
  const { contrastOn } = await import('../design-check/scripts/lib/tokens.mjs');
  assert.equal(contrastOn('#FF0000'), '#FFFFFF');   // 빨강 → 흰 글자
  assert.equal(contrastOn('#0046FF'), '#FFFFFF');   // 파랑 → 흰 글자
  assert.equal(contrastOn('#FFD400'), '#111111');   // 노랑 → 진회색
  assert.equal(contrastOn('#FFFFFF'), '#111111');
  assert.equal(contrastOn('#000000'), '#FFFFFF');
});
