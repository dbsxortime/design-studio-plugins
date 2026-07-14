import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';
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

test('--gallery: qr.svg 있으면 QR 카드에 주입 (pending 아님)', () => {
  const d = proj();
  mkdirSync(join(d, '.design/card'), { recursive: true });
  writeFileSync(join(d, '.design/card/qr.svg'), '<svg viewBox="0 0 33 33"><path stroke="#000" d="M4 4.5h7"/></svg>');
  execFileSync('node', [SCRIPT, d, '--gallery']);
  const g = readFileSync(join(d, '.design/card/gallery.html'), 'utf8');
  assert.ok(g.includes('<path stroke="#000" d="M4 4.5h7"/>'));
  assert.ok(!g.includes('<!--qr-pending-->'));
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

test('--print: @page 규격, 2시트, 재단선, 가이드 오버라이드', () => {
  const d = proj();
  const st = JSON.parse(readFileSync(join(d, '.design/card.json'), 'utf8'));
  st.final = '1-1';
  writeFileSync(join(d, '.design/card.json'), JSON.stringify(st));
  const outJson = JSON.parse(execFileSync('node', [SCRIPT, d, '--print']).toString());
  const p = readFileSync(join(d, '.design/card/print.html'), 'utf8');
  assert.ok(p.includes('@page { size: 94mm 54mm'));            // landscape 기본
  assert.strictEqual((p.match(/class="sheet/g) || []).length, 2);
  assert.ok(p.includes('trimline') && p.includes('page-break-after'));
  assert.ok(p.includes('print-color-adjust: exact'));
  // 커버 배율: 카드가 블리드(94×54)까지 채우도록 확대 — max(94mm/270px, 54mm/150px) ≈ 1.3606
  assert.ok(p.includes('zoom:1.3606'));
  // 실물 재단 대응: 인쇄판에서 라운드·그림자 제거
  assert.ok(p.includes('border-radius:0') && p.includes('box-shadow:none'));
  assert.ok(outJson.pdfCmd.includes('--print-to-pdf') && outJson.cmykCmd.includes('CMYK'));
  // 인쇄소 가이드 오버라이드
  const st2 = JSON.parse(readFileSync(join(d, '.design/card.json'), 'utf8'));
  st2.printSpec = { trimW: 91, trimH: 55, bleed: 1 };
  writeFileSync(join(d, '.design/card.json'), JSON.stringify(st2));
  execFileSync('node', [SCRIPT, d, '--print']);
  const p2 = readFileSync(join(d, '.design/card/print.html'), 'utf8');
  assert.ok(p2.includes('@page { size: 93mm 57mm'));
});

test('--print: 상대경로 프로젝트도 절대 file:// URL 생성', () => {
  const d = proj();
  const st = JSON.parse(readFileSync(join(d, '.design/card.json'), 'utf8'));
  st.final = '1-1';
  writeFileSync(join(d, '.design/card.json'), JSON.stringify(st));
  // 프로젝트를 상대경로로 넘겨도 pdfCmd가 깨진 file://.design/... 이 되면 안 됨
  const out = JSON.parse(execFileSync('node',
    [resolve(SCRIPT), basename(d), '--print'], { cwd: dirname(d) }).toString());
  assert.ok(out.pdfCmd.includes('file:///'), 'file:// URL은 절대경로여야 함');
  assert.ok(!out.pdfCmd.includes('file://.'), '상대 file:// URL 금지');
});

test('--variants: 같은 round 재실행 시 기존 라벨 유지', () => {
  const d = proj();
  execFileSync('node', [SCRIPT, d, '--variants', '--pick', '1-1', '--label', '커스텀 라벨']);
  execFileSync('node', [SCRIPT, d, '--variants', '--pick', '1-1', '--compare']);
  const st = JSON.parse(readFileSync(join(d, '.design/card.json'), 'utf8'));
  assert.strictEqual(st.rounds[0].label, '커스텀 라벨');
});
