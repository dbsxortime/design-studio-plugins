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

test('--brandbook — 패턴 타일은 tokens.color.bg 배경 + background-image 반복, 셰이프 타일은 surface 배경 + 인라인 img', () => {
  const dir = makeProject();
  mkdirSync(join(dir, '.design', 'brand', 'graphics'), { recursive: true });
  writeFileSync(join(dir, '.design', 'brand', 'graphics', 'pattern-a.svg'), candSvg('#123456'));
  writeFileSync(join(dir, '.design', 'brand', 'graphics', 'shape-1.svg'), candSvg('#abcdef'));

  execFileSync('node', [SCRIPT, dir, '--brandbook']);
  const html = readFileSync(join(dir, '.design', 'brand', 'brandbook.html'), 'utf8');

  const patternMatch = html.match(/<div class="graphics-tile pattern-tile" style="([^"]*)">/);
  assert.ok(patternMatch, '패턴 타일을 찾지 못함');
  assert.ok(patternMatch[1].includes(`background-color:${TOKENS.color.bg}`), '패턴 타일 배경은 tokens.color.bg여야 함');
  assert.ok(patternMatch[1].includes("background-image:url('graphics/pattern-a.svg')"), '패턴 타일은 background-image로 반복 렌더해야 함');
  assert.ok(!patternMatch[1].includes(TOKENS.color.surface), '패턴 타일 배경이 surface면 안 됨(원래 결함)');

  const shapeMatch = html.match(/<div class="graphics-tile" style="([^"]*)"><img/);
  assert.ok(shapeMatch, '셰이프 타일을 찾지 못함');
  assert.ok(shapeMatch[1].includes(`background:${TOKENS.color.surface}`), '셰이프 타일 배경은 기존대로 surface여야 함');
  const shapeB64 = Buffer.from(candSvg('#abcdef'), 'utf8').toString('base64');
  assert.ok(html.includes(shapeB64), '셰이프 타일은 기존대로 인라인 img(data URI)여야 함');
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

// ── --concept (쇼케이스 랜딩) ──
test('--concept — 결정성(2회 실행 바이트 동일)', () => {
  const dir = makeProject();
  execFileSync('node', [SCRIPT, dir, '--concept']);
  const first = readFileSync(join(dir, '.design', 'brand', 'concept.html'), 'utf8');
  execFileSync('node', [SCRIPT, dir, '--concept']);
  const second = readFileSync(join(dir, '.design', 'brand', 'concept.html'), 'utf8');
  assert.strictEqual(first, second);
});

test('--concept — 히어로에 프로젝트명·슬로건 존재 + 반응형(viewport meta + 미디어쿼리)', () => {
  const dir = makeProject();
  // 슬로건 소스: brief.philosophy 우선
  const brand = JSON.parse(readFileSync(join(dir, '.design', 'brand.json'), 'utf8'));
  brand.brief.philosophy = '감정을 잇는 리듬';
  writeFileSync(join(dir, '.design', 'brand.json'), JSON.stringify(brand));
  execFileSync('node', [SCRIPT, dir, '--concept']);
  const html = readFileSync(join(dir, '.design', 'brand', 'concept.html'), 'utf8');

  assert.ok(html.includes('class="hero-title">Fixture Brand<'), '히어로에 프로젝트명 없음');
  assert.ok(html.includes('감정을 잇는 리듬'), '히어로 슬로건(philosophy) 없음');
  assert.ok(html.includes('name="viewport"'), 'viewport meta 없음');
  assert.ok(html.includes('@media (max-width:720px)'), '반응형 미디어쿼리 없음');
});

test('--concept — 키워드 카드 정확히 3개', () => {
  const dir = makeProject();
  execFileSync('node', [SCRIPT, dir, '--concept']);
  const html = readFileSync(join(dir, '.design', 'brand', 'concept.html'), 'utf8');
  assert.strictEqual((html.match(/class="keyword-card"/g) || []).length, 3, '키워드 카드 3개 아님');
});

test('--concept — motion.logoAnim=fade면 logo-fade 클래스, none이면 부재', () => {
  const dir = makeProject();
  execFileSync('node', [SCRIPT, dir, '--concept']);
  assert.ok(readFileSync(join(dir, '.design', 'brand', 'concept.html'), 'utf8').includes('logo-fade'),
    'fade일 때 logo-fade 클래스 없음');

  const brand = JSON.parse(readFileSync(join(dir, '.design', 'brand.json'), 'utf8'));
  brand.motion.logoAnim = 'none';
  writeFileSync(join(dir, '.design', 'brand.json'), JSON.stringify(brand));
  execFileSync('node', [SCRIPT, dir, '--concept']);
  assert.ok(!readFileSync(join(dir, '.design', 'brand', 'concept.html'), 'utf8').includes('logo-fade'),
    'none일 때 logo-fade 클래스가 남음');
});

test('--concept — details 비활성 항목의 라이브 조각 미포함(spinner off)', () => {
  const dir = makeProject();
  // details.css 존재 + spinner 비활성 → ds-spinner 조각 없음, ds-skeleton은 존재
  writeFileSync(join(dir, '.design', 'brand', 'details.css'), '/* live */');
  const brand = JSON.parse(readFileSync(join(dir, '.design', 'brand.json'), 'utf8'));
  brand.assets.details = [{ id: 'spinner', enabled: false }];
  writeFileSync(join(dir, '.design', 'brand.json'), JSON.stringify(brand));
  execFileSync('node', [SCRIPT, dir, '--concept']);
  const html = readFileSync(join(dir, '.design', 'brand', 'concept.html'), 'utf8');

  assert.ok(!html.includes('ds-spinner'), '비활성 spinner의 라이브 조각이 포함됨');
  assert.ok(html.includes('ds-skeleton'), '활성 skeleton의 라이브 조각이 없음');
  assert.ok(html.includes('href="details.css"'), 'details.css 링크 없음');
});

test('--concept — brand.json 없으면 exit 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'board-'));
  assert.throws(() => execFileSync('node', [SCRIPT, dir, '--concept'], { stdio: 'pipe' }));
});
