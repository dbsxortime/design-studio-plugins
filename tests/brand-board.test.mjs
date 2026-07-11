import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, mkdtempSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = 'brand-studio/scripts/brand-board.mjs';

const TOKENS = {
  $schema: 'design-studio/tokens-v1',
  meta: { project: 'fixture', updated: '2026-07-12', source: 'onboarding' },
  color: { primary: '#0046FF', onPrimary: '#FFFFFF', bg: '#ffffff',
    surface: '#f4f5f7', text: '#111111', muted: '#777777' },
  font: { family: 'Pretendard', headingWeight: 800, bodySize: '14px' },
  radius: { base: '10px', card: '14px', pill: '999px' },
  spacing: { unit: '4px', gutter: '16px' },
  tolerance: { colorDeltaE: 5, radiusPx: 2 },
};

// brand-v1 §6 전체 필드 반영(스펙 docs/superpowers/specs/2026-07-11-brand-studio-design.md)
const BRAND = {
  $schema: 'brand-studio/brand-v1',
  meta: { project: 'Fixture Brand', updated: '2026-07-12' },
  brief: { keywords: ['modern', 'friendly', 'bold'] },
  decisions: { logoType: 'wordmark' },
  logo: {
    svg: '.design/brand/logo/logo.svg',
    variants: ['horizontal-color', 'symbol-mono'],
    clearspace: '0.5x', minSizePx: 24,
  },
  graphics: { patterns: ['pattern-a.svg'], shapes: ['shape-1.svg'], motifNote: 'circles and arcs' },
  motion: { logoAnim: 'fade', reducedFallback: true },
  assets: { favicon: { simplified: true }, details: [{ id: 'scrollbar', enabled: false }] },
  progress: { phase: 'final' },
};

const LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#0046FF"/></svg>';

function makeProject() {
  const dir = mkdtempSync(join(tmpdir(), 'board-'));
  mkdirSync(join(dir, '.design', 'brand', 'logo'), { recursive: true });
  writeFileSync(join(dir, '.design', 'tokens.json'), JSON.stringify(TOKENS));
  writeFileSync(join(dir, '.design', 'brand.json'), JSON.stringify(BRAND));
  writeFileSync(join(dir, '.design', 'brand', 'logo', 'logo.svg'), LOGO_SVG);
  return dir;
}

function candSvg(color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="${color}"/></svg>`;
}

test('--board — 시안 3개 + 다크 배경 섹션 + 32px 박스 존재', () => {
  const dir = makeProject();
  const colors = ['#ff0000', '#00ff00', '#0000ff'];
  const svgPaths = colors.map((color, i) => {
    const p = join(dir, `cand${i + 1}.svg`);
    writeFileSync(p, candSvg(color));
    return p;
  });
  execFileSync('node', [SCRIPT, dir, '--board', ...svgPaths, '--label', '라운드1']);
  const html = readFileSync(join(dir, '.design', 'brand', '_board.html'), 'utf8');

  for (let i = 1; i <= 3; i++) {
    assert.ok(html.includes(`id="board-candidate-${i}"`), `안 ${i} 식별자 없음`);
  }
  assert.strictEqual((html.match(/board-dark/g) || []).length, 3, '다크 배경 박스 3개 필요');
  assert.strictEqual((html.match(/board-32/g) || []).length, 3, '32px 박스 3개 필요');
  assert.ok(html.includes('라운드1'), '라벨 반영 안 됨');
  for (const color of colors) {
    const b64 = Buffer.from(candSvg(color), 'utf8').toString('base64');
    assert.ok(html.includes(b64), `시안(${color}) 콘텐츠 미포함`);
  }
});

test('--board — 시안이 정확히 3개가 아니면 exit 1', () => {
  const dir = makeProject();
  const p1 = join(dir, 'cand1.svg');
  writeFileSync(p1, candSvg('#ff0000'));
  assert.throws(() => execFileSync('node', [SCRIPT, dir, '--board', p1], { stdio: 'pipe' }));
});

test('--brandbook — 결정성(2회 실행 바이트 동일)', () => {
  const dir = makeProject();
  execFileSync('node', [SCRIPT, dir, '--brandbook']);
  const first = readFileSync(join(dir, '.design', 'brand', 'brandbook.html'), 'utf8');
  execFileSync('node', [SCRIPT, dir, '--brandbook']);
  const second = readFileSync(join(dir, '.design', 'brand', 'brandbook.html'), 'utf8');
  assert.strictEqual(first, second);
});

test('--brandbook — 필수 섹션 6개 헤딩 + 토큰 primary 무손실 + 자산 미존재 시 placeholder', () => {
  const dir = makeProject();
  execFileSync('node', [SCRIPT, dir, '--brandbook']);
  const html = readFileSync(join(dir, '.design', 'brand', 'brandbook.html'), 'utf8');

  const headings = ['로고 시스템', '색', '타이포', '그래픽 언어', '적용 자산', '모션·디테일'];
  for (const h of headings) assert.ok(html.includes(`<h2>${h}</h2>`), `헤딩 없음: ${h}`);

  assert.ok(html.includes(TOKENS.color.primary), 'primary 토큰 값 무손실 아님');
  // asset-expand를 아직 안 돌린 프로젝트 → favicon.svg/og.png 미존재 → placeholder 표기
  assert.ok(html.includes('placeholder'), '자산 미존재 placeholder 미표기');
  // Do/Don't 4칙
  const donts = html.match(/<ul class="donts">([\s\S]*?)<\/ul>/);
  assert.ok(donts, 'Do/Don\'t 목록 없음');
  assert.strictEqual((donts[1].match(/<li>/g) || []).length, 4);
});

test('--brandbook — graphics.patterns/shapes 없으면 "미정" 표기', () => {
  const dir = makeProject();
  const brand = JSON.parse(readFileSync(join(dir, '.design', 'brand.json'), 'utf8'));
  delete brand.graphics;
  writeFileSync(join(dir, '.design', 'brand.json'), JSON.stringify(brand));
  execFileSync('node', [SCRIPT, dir, '--brandbook']);
  const html = readFileSync(join(dir, '.design', 'brand', 'brandbook.html'), 'utf8');
  assert.ok(html.includes('미정'));
});

test('--brandbook — tokens.json 없으면 exit 1', () => {
  const dir = makeProject();
  unlinkSync(join(dir, '.design', 'tokens.json'));
  assert.throws(() => execFileSync('node', [SCRIPT, dir, '--brandbook'], { stdio: 'pipe' }));
});

test('brand.json 없는 프로젝트 → exit 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'board-'));
  assert.throws(() => execFileSync('node', [SCRIPT, dir, '--brandbook'], { stdio: 'pipe' }));
  assert.throws(() => execFileSync('node', [SCRIPT, dir, '--board', 'a.svg', 'b.svg', 'c.svg'], { stdio: 'pipe' }));
});
