import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daisyTheme } from '../scripts/lib/tokens.mjs';

const tokens = { meta:{project:'acme'}, color:{primary:'#0046FF',bg:'#FFFFFF',surface:'#F7F7FB',text:'#111111',muted:'#6B6980'}, radius:{base:'2px',card:'2px'} };

test('daisyTheme: @plugin 블록 + tokens 매핑', () => {
  const css = daisyTheme(tokens);
  assert.match(css, /@plugin "daisyui\/theme"/);
  assert.match(css, /name: "acme"/);
  assert.match(css, /--color-primary: #0046FF/);
  assert.match(css, /--color-base-100: #FFFFFF/);
  assert.match(css, /--color-base-200: #F7F7FB/);
  assert.match(css, /--color-base-content: #111111/);
  assert.match(css, /--color-neutral: #6B6980/);
  assert.match(css, /--radius-box: 2px/);
});

test('daisyTheme: project 없으면 custom', () => {
  const css = daisyTheme({ color:{primary:'#111111',bg:'#fff',surface:'#eee',text:'#000',muted:'#888'}, radius:{base:'4px'} });
  assert.match(css, /name: "custom"/);
});
