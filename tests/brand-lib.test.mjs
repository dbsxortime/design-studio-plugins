import { test } from 'node:test';
import assert from 'node:assert';
import {
  PHASES, validateBrand, nextPhase, toMono, maskableWrap,
  deriveDetailsCss, deriveManifest, pngSize,
} from '../brand-studio/scripts/lib/brand.mjs';

// tokens-v1 (tests/inject.test.mjs TOKENS 형태 참고, 자기충족)
const TOKENS = {
  $schema: 'design-studio/tokens-v1',
  meta: { project: 'fixture', updated: '2026-07-10', source: 'onboarding' },
  color: { primary: '#0046FF', onPrimary: '#FFFFFF', bg: '#ffffff',
    surface: '#f4f5f7', text: '#111111', muted: '#777777' },
  font: { family: 'Pretendard', headingWeight: 800, bodySize: '14px' },
  radius: { base: '10px', card: '14px', pill: '999px' },
  spacing: { unit: '4px', gutter: '16px' },
  tolerance: { colorDeltaE: 5, radiusPx: 2 },
};

// brand-v1 (스펙 §6)
const BRAND = {
  $schema: 'brand-studio/brand-v1',
  meta: { project: 'fixture-brand', updated: '2026-07-12' },
  brief: { keywords: ['modern', 'friendly', 'bold'] },
  decisions: { logoType: 'wordmark' },
  assets: { favicon: { simplified: true }, details: [] },
  progress: { phase: 'brief' },
};

// 세상에서 가장 작은 PNG(1x1, 투명) — base64
const PNG_1PX_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('toMono — 모든 fill/stroke 단색화, none 유지', () => {
  const svg = '<svg><rect fill="#ff0000"/><path stroke="blue" fill="none"/></svg>';
  const out = toMono(svg, '#111111');
  assert.ok(!out.includes('#ff0000') && !out.includes('blue'));
  assert.ok(out.includes('fill="none"'));
  assert.ok(out.includes('#111111'));
});

test('toMono — url() 참조도 단색화', () => {
  const svg = '<svg><rect fill="url(#grad1)"/></svg>';
  const out = toMono(svg, '#222222');
  assert.ok(!out.includes('url(#grad1)'));
  assert.ok(out.includes('fill="#222222"'));
});

test('toMono — <style> 블록 내부 fill/stroke도 단색화', () => {
  const svg = '<svg><style>.a{fill:#ff0000;stroke:blue}</style><rect class="a"/></svg>';
  const out = toMono(svg, '#111111');
  assert.ok(!out.includes('#ff0000') && !out.includes('blue'));
  assert.ok(out.includes('#111111'));
});

test('toMono — 작은따옴표 속성도 단색화, none 유지', () => {
  const svg = "<svg><rect fill='#ff0000' stroke='none'/></svg>";
  const out = toMono(svg, '#111111');
  assert.ok(!out.includes('#ff0000'));
  assert.ok(out.includes("fill='#111111'"));
  assert.ok(out.includes("stroke='none'"));
});

test('maskableWrap — 중앙 80% 배치(x=y=10%)', () => {
  const out = maskableWrap('<svg viewBox="0 0 100 100"><circle r="50"/></svg>', 512, '#ffffff');
  assert.ok(out.includes('width="512"'));
  assert.ok(/x="51.2".*y="51.2"|translate\(51\.2[, ]/.test(out.replace(/\n/g, '')));  // 512*0.1
});

test('maskableWrap — 배경색 반영 + 원본 콘텐츠 보존', () => {
  const out = maskableWrap('<svg viewBox="0 0 100 100"><circle r="50"/></svg>', 512, '#101010');
  assert.ok(out.includes('fill="#101010"'));
  assert.ok(out.includes('<circle r="50"/>'));
});

test('deriveDetailsCss — 토큰 무손실 + reduced-motion 폴백', () => {
  const css = deriveDetailsCss(TOKENS, BRAND);
  assert.ok(css.includes('::selection'));
  assert.ok(css.includes(TOKENS.color.primary));
  assert.ok(css.includes('prefers-reduced-motion'));
});

test('deriveDetailsCss — 항목별 마커 존재(7종)', () => {
  const css = deriveDetailsCss(TOKENS, BRAND);
  for (const id of ['spinner', 'skeleton', 'selection', 'focus-ring', 'scrollbar', 'fade-in', 'press']) {
    assert.ok(css.includes(`/* detail:${id} */`), `marker 누락: ${id}`);
  }
});

test('deriveDetailsCss — 제외 항목 미포함', () => {
  const b = { ...BRAND, assets: { ...BRAND.assets, details: [{ id: 'scrollbar', enabled: false }] } };
  const css = deriveDetailsCss(TOKENS, b);
  assert.ok(!css.includes('::-webkit-scrollbar'));
  assert.ok(!css.includes('/* detail:scrollbar */'));
  assert.ok(css.includes('/* detail:selection */'));  // 다른 항목은 기본 활성 유지
});

test('deriveManifest — theme_color/background_color/icons', () => {
  const m = deriveManifest(BRAND, TOKENS);
  assert.strictEqual(m.name, BRAND.meta.project);
  assert.strictEqual(m.theme_color, TOKENS.color.primary);
  assert.strictEqual(m.background_color, TOKENS.color.bg);
  const sizes = m.icons.map(i => i.sizes);
  assert.ok(sizes.includes('192x192'));
  assert.ok(sizes.includes('512x512'));
  assert.ok(m.icons.some(i => i.purpose === 'maskable'));
});

test('pngSize — IHDR 파싱', () => {
  const { w, h } = pngSize(Buffer.from(PNG_1PX_B64, 'base64'));
  assert.strictEqual(w, 1); assert.strictEqual(h, 1);
});

test('validateBrand / nextPhase', () => {
  assert.strictEqual(validateBrand(BRAND).ok, true);
  assert.deepStrictEqual(validateBrand(BRAND).errors, []);

  const badKeywords = { ...BRAND, brief: { keywords: ['only-two'] } };
  const r1 = validateBrand(badKeywords);
  assert.strictEqual(r1.ok, false);
  assert.ok(r1.errors.length > 0);

  const badLogo = { ...BRAND, decisions: { logoType: 'not-a-type' } };
  assert.strictEqual(validateBrand(badLogo).ok, false);

  const badPhase = { ...BRAND, progress: { phase: 'nope' } };
  assert.strictEqual(validateBrand(badPhase).ok, false);

  const missingProject = { ...BRAND, meta: {} };
  assert.strictEqual(validateBrand(missingProject).ok, false);

  assert.deepStrictEqual(PHASES,
    ['brief', 'logo', 'system', 'graphics', 'applications', 'details', 'final', 'exported']);
  assert.strictEqual(nextPhase('brief'), 'logo');
  assert.strictEqual(nextPhase('details'), 'final');
  assert.strictEqual(nextPhase('exported'), null);
  assert.strictEqual(nextPhase('unknown-phase'), null);
});
