import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = 'design-check/scripts/tokens-to-code.mjs';

function makeProject(tokens) {
  const dir = mkdtempSync(join(tmpdir(), 'inject-'));
  mkdirSync(join(dir, '.design'), { recursive: true });
  writeFileSync(join(dir, '.design', 'tokens.json'), JSON.stringify(tokens));
  return dir;
}

const TOKENS = {
  $schema: 'design-studio/tokens-v1',
  meta: { project: 'fixture', updated: '2026-07-10', source: 'onboarding' },
  color: { primary: '#0046FF', bg: '#ffffff', surface: '#f4f5f7',
    text: '#111111', muted: '#777777', allowed: ['#00C471'] },
  font: { family: 'Pretendard', headingWeight: 800, bodySize: '14px' },
  radius: { base: '10px', card: '14px', pill: '999px' },
  spacing: { unit: '4px', gutter: '16px' },
  tolerance: { colorDeltaE: 5, radiusPx: 2 },
};

test('tokens-to-code: css 생성 — 값 그대로 + onPrimary 자동 대비', () => {
  const dir = makeProject(TOKENS);   // onPrimary 미지정 → 자동 계산
  const out = JSON.parse(execFileSync('node', [SCRIPT, dir], { encoding: 'utf8' }));
  assert.strictEqual(out.onPrimary.auto, true);
  assert.strictEqual(out.onPrimary.value, '#FFFFFF');   // #0046FF 위 = 흰색
  const css = readFileSync(join(dir, '.design', 'tokens.css'), 'utf8');
  assert.ok(css.includes(':root {'));
  assert.ok(css.includes('--color-primary: #0046FF;'));
  assert.ok(css.includes('--color-on-primary: #FFFFFF;'));
  assert.ok(css.includes('--color-allowed-1: #00C471;'));
  assert.ok(css.includes("--font-sans: 'Pretendard', sans-serif;"));
  assert.ok(css.includes('--radius-base: 10px;'));
  assert.ok(css.includes('--spacing-unit: 4px;'));
});

test('tokens-to-code: 결정적 — 재실행해도 바이트 동일', () => {
  const dir = makeProject(TOKENS);
  execFileSync('node', [SCRIPT, dir]);
  const first = readFileSync(join(dir, '.design', 'tokens.css'), 'utf8');
  execFileSync('node', [SCRIPT, dir]);
  const second = readFileSync(join(dir, '.design', 'tokens.css'), 'utf8');
  assert.strictEqual(first, second);
});

test('tokens-to-code: tailwind 포맷 — @theme 블록', () => {
  const dir = makeProject({ ...TOKENS, color: { ...TOKENS.color, onPrimary: '#111111' } });
  execFileSync('node', [SCRIPT, dir, '--format', 'tailwind']);
  const tw = readFileSync(join(dir, '.design', 'tokens.tailwind.css'), 'utf8');
  assert.ok(tw.includes('@theme {'));
  assert.ok(tw.includes('--color-on-primary: #111111;'));   // 명시값 우선, 자동 계산 안 함
});

test('tokens-to-code: all — 두 파일 모두, 폰트 스택은 그대로 통과', () => {
  const dir = makeProject({ ...TOKENS,
    font: { ...TOKENS.font, family: "'Inter', 'Roboto', sans-serif" } });
  const out = JSON.parse(execFileSync('node', [SCRIPT, dir, '--format', 'all'], { encoding: 'utf8' }));
  assert.strictEqual(out.written.length, 2);
  const css = readFileSync(join(dir, '.design', 'tokens.css'), 'utf8');
  assert.ok(css.includes("--font-sans: 'Inter', 'Roboto', sans-serif;"));   // 재인용 없음
});

test('tokens-to-code: 필수 색 누락(빈 변수 손실) → exit 1', () => {
  const { bg, ...rest } = TOKENS.color;   // bg 제거 — validateTokens는 통과하는 케이스
  const dir = makeProject({ ...TOKENS, color: rest });
  assert.throws(() => execFileSync('node', [SCRIPT, dir], { stdio: 'pipe' }),
    /color\.bg 누락/);
});

test('tokens-to-code: 잘못된 tokens.json → exit 1', () => {
  const dir = makeProject({ $schema: 'design-studio/tokens-v1', color: {} });
  assert.throws(() => execFileSync('node', [SCRIPT, dir], { stdio: 'pipe' }));
});

test('tokens-to-code: tokens.json 없음 → exit 1 + 안내', () => {
  const dir = mkdtempSync(join(tmpdir(), 'inject-empty-'));
  assert.throws(() => execFileSync('node', [SCRIPT, dir], { stdio: 'pipe' }),
    /design-tokens/);
});
