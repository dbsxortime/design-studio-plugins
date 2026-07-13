import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = 'brand-studio/scripts/card-board.mjs';
const TOKENS = { $schema: 'design-studio/tokens-v1', meta: { project: 'fx' },
  color: { primary: '#0046FF', onPrimary: '#FFFFFF', bg: '#ffffff',
    surface: '#f4f5f7', text: '#111111', muted: '#777777' },
  font: { family: 'Pretendard', headingWeight: 800, bodySize: '14px' },
  radius: { base: '10px', card: '14px', pill: '999px' } };
const INFO = { name: '김철수', role: 'Designer', org: 'acme', domain: 'acme.io',
  phone: '010-1234-5678', email: 'kim@acme.io', slogan1: 'Small', slogan2: 'Big', copy: '카피' };

function proj() {
  const d = mkdtempSync(join(tmpdir(), 'card-'));
  mkdirSync(join(d, '.design'), { recursive: true });
  writeFileSync(join(d, '.design/tokens.json'), JSON.stringify(TOKENS));
  writeFileSync(join(d, '.design/card.json'), JSON.stringify({ $schema: 'brand-studio/card-v1', info: INFO, picks: [], rounds: [], final: null, exports: [] }));
  return d;
}

test('--gallery: 69종, 토큰 재스킨, 슬롯 잔존 0, 배지, 결정성', () => {
  const d = proj();
  execFileSync('node', [SCRIPT, d, '--gallery', '--recommend', '3-1,6-1']);
  const g1 = readFileSync(join(d, '.design/card/gallery.html'), 'utf8');
  assert.strictEqual((g1.match(/class="tpl" /g) || []).length, 69);
  assert.ok(g1.includes('#0046FF') && !g1.includes('#332D7B'));   // 재스킨
  assert.ok(g1.includes('김철수') && !g1.includes('{{name}}'));
  assert.ok(!/\{\{[a-zA-Z]+\}\}/.test(g1.replace(/<!--qr-pending-->/g, '')));
  assert.ok(g1.includes('✨'));                                    // 추천 배지
  execFileSync('node', [SCRIPT, d, '--gallery', '--recommend', '3-1,6-1']);
  assert.strictEqual(readFileSync(join(d, '.design/card/gallery.html'), 'utf8'), g1); // 결정성
});

test('--variants: 선택 추출 + 라벨 + compare 확대 + 상태 기록', () => {
  const d = proj();
  execFileSync('node', [SCRIPT, d, '--variants', '--pick', '1-1,2-1']);
  const v = readFileSync(join(d, '.design/card/variants-v1.html'), 'utf8');
  assert.strictEqual((v.match(/class="tpl" /g) || []).length, 2);
  assert.ok(v.includes('V1a') && v.includes('V1b'));
  assert.ok(v.includes('김철수'));
  const st = JSON.parse(readFileSync(join(d, '.design/card.json'), 'utf8'));
  assert.deepStrictEqual(st.rounds[0].picks, ['1-1', '2-1']);
  execFileSync('node', [SCRIPT, d, '--variants', '--pick', '1-1,2-1']); // 같은 round 재실행
  const st2 = JSON.parse(readFileSync(join(d, '.design/card.json'), 'utf8'));
  assert.strictEqual(st2.rounds.length, 1);                              // append 아님
  execFileSync('node', [SCRIPT, d, '--variants', '--pick', '1-1', '--round', '2', '--compare']);
  const c = readFileSync(join(d, '.design/card/variants-v2.html'), 'utf8');
  assert.ok(c.includes('zoom:2.4'));
});
