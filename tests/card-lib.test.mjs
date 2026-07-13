import { test } from 'node:test';
import assert from 'node:assert';
import { deriveCardTokens, fillSlots } from '../brand-studio/scripts/lib/card.mjs';

const TOKENS = { color: { primary: '#0046FF', onPrimary: '#FFFFFF', bg: '#ffffff',
  surface: '#f4f5f7', text: '#111111', muted: '#777777' } };
const INFO = { name: '김철수', role: 'Designer', org: 'acme', domain: 'acme.io',
  phone: '010-1234-5678', email: 'kim@acme.io', slogan1: 'Small Team', slogan2: 'Big Impact', copy: '한 줄 카피' };

test('deriveCardTokens: 12키 + 기본 매핑', () => {
  const t = deriveCardTokens(TOKENS);
  assert.strictEqual(t['--c-primary'], '#0046FF');
  assert.strictEqual(t['--c-text'], '#111111');
  for (const k of ['--c-a-lav', '--c-a-lav2', '--c-a-light', '--c-a-deep', '--c-a-ink2'])
    assert.ok(t[k].includes('#0046FF') || t[k].includes('#111111'), k);
  assert.strictEqual(Object.keys(t).length, 12);
});

test('fillSlots: 전 슬롯 치환 + 파생값 + 결정성', () => {
  const src = '<b>{{name}}</b>{{orgUpper}}{{initial}}{{monogram}}<i>{{qr}}</i>';
  const a = fillSlots(src, INFO), b = fillSlots(src, INFO);
  assert.strictEqual(a, b);
  assert.ok(a.includes('김철수') && a.includes('ACME') && a.includes('김') && a.includes('AC'));
  assert.ok(a.includes('<!--qr-pending-->'));
  assert.ok(!/\{\{[a-zA-Z]+\}\}/.test(a));
});
