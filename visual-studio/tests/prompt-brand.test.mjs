import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScaffold, aspectFor, negativeFrom } from '../scripts/lib/prompt-brand.mjs';

const tokens = { color: { primary: '#0046FF', allowed: ['#0046FF', '#EAF1FF', '#111111'] } };

test('aspectFor: og는 1200x630', () => {
  assert.deepEqual(aspectFor('og'), { w: 1200, h: 630 });
});

test('aspectFor: 미지정은 hero 기본', () => {
  assert.deepEqual(aspectFor('unknown'), aspectFor('hero'));
});

test('negativeFrom: forbid 목록이 네거티브에 반영', () => {
  const neg = negativeFrom({ forbid: ['gradient', 'emoji'] });
  assert.match(neg, /text/);       // 항상 포함
  assert.match(neg, /gradient/);
  assert.match(neg, /emoji/);
});

test('buildScaffold: 팔레트 hex가 positive에 포함', () => {
  const s = buildScaffold({ tokens, brand: {}, intent: 'hero background', use: 'hero' });
  assert.match(s.positive, /#0046FF/);
  assert.equal(s.aspect.w, 1920);
  assert.ok(['strong', 'light'].includes(s.paletteLock));
  assert.deepEqual(s.palette, ['#0046FF', '#EAF1FF', '#111111']);
});
