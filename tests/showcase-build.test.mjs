import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = 'brand-studio/scripts/showcase-build.mjs';
const TOKENS = { $schema: 'design-studio/tokens-v1', meta: { project: 'fxbrand' },
  color: { primary: '#0046FF', onPrimary: '#FFFFFF', bg: '#ffffff',
    surface: '#f4f5f7', text: '#111111', muted: '#777777' },
  font: { family: 'Pretendard', headingWeight: 800, bodySize: '14px' },
  radius: { base: '10px', card: '14px', pill: '999px' } };

function proj({ withCard = false } = {}) {
  const d = mkdtempSync(join(tmpdir(), 'showcase-'));
  mkdirSync(join(d, '.design/brand'), { recursive: true });
  writeFileSync(join(d, '.design/tokens.json'), JSON.stringify(TOKENS));
  writeFileSync(join(d, '.design/brand.json'), JSON.stringify({
    $schema: 'brand-studio/brand-v1', meta: { project: 'fxbrand' },
    brief: { philosophy: '한 줄 철학', keywords: ['a', 'b', 'c'] },
    applications: { og: { slogan: '한 줄 철학' } } }));
  writeFileSync(join(d, '.design/brand/concept.html'), '<html><head></head><body><h1>concept</h1></body></html>');
  writeFileSync(join(d, '.design/brand/brandbook.html'), '<html><head></head><body><h1>book</h1></body></html>');
  writeFileSync(join(d, '.design/brand/details.css'), ':root{}');
  if (withCard) {
    mkdirSync(join(d, '.design/card'), { recursive: true });
    mkdirSync(join(d, 'print'), { recursive: true });
    writeFileSync(join(d, '.design/card/gallery.html'), '<html><head></head><body>gallery</body></html>');
    writeFileSync(join(d, 'print/card-90x50.pdf'), '%PDF-fake');
    writeFileSync(join(d, '.design/card.json'), JSON.stringify({
      $schema: 'brand-studio/card-v1', info: {}, picks: [], rounds: [],
      final: '1-1', exports: [join(d, '.design/card/print.html'), join(d, 'print/card-90x50.pdf')] }));
  }
  return d;
}

test('showcase: 브랜드 산출물만 있어도 번들 생성, 바 주입, 토큰 색 파생', () => {
  const d = proj();
  const out = JSON.parse(execFileSync('node', [SCRIPT, d]).toString());
  assert.deepStrictEqual(out.artifacts, ['concept.html', 'brandbook.html']);
  const con = readFileSync(join(d, '.design/showcase/concept.html'), 'utf8');
  assert.ok(con.includes('id="nsb"'));
  assert.ok(con.includes('#0046FF'));                       // 활성 탭 = primary
  assert.ok(con.includes('실제 산출물'));
  assert.ok(con.includes('한 줄 철학'));                     // brief.philosophy 반영
  assert.ok(!con.includes('명함 갤러리'));                   // 없는 산출물 탭 미노출
  const idx = readFileSync(join(d, '.design/showcase/index.html'), 'utf8');
  assert.ok(idx.includes('url=concept.html'));
  assert.ok(out.note && out.note.includes('base-url'));      // base-url 미지정 안내
});

test('showcase: 명함 있으면 갤러리 탭 + PDF 링크, base-url이면 og:image', () => {
  const d = proj({ withCard: true });
  const out = JSON.parse(execFileSync('node',
    [SCRIPT, d, '--base-url', 'https://brand.example.dev/fx']).toString());
  assert.deepStrictEqual(out.artifacts, ['concept.html', 'brandbook.html', 'card-gallery.html']);
  assert.strictEqual(out.pdf, 'card-90x50.pdf');
  assert.ok(existsSync(join(d, '.design/showcase/card-90x50.pdf')));
  const g = readFileSync(join(d, '.design/showcase/card-gallery.html'), 'utf8');
  assert.ok(g.includes('인쇄 PDF ↓') && g.includes('class="on"'));
  // og:image는 og.png가 없으면 base-url이 있어도 생략 (파일 없는 픽스처)
  assert.strictEqual(out.ogImage, false);
  // 결정성
  const before = readFileSync(join(d, '.design/showcase/concept.html'), 'utf8');
  execFileSync('node', [SCRIPT, d, '--base-url', 'https://brand.example.dev/fx']);
  assert.strictEqual(readFileSync(join(d, '.design/showcase/concept.html'), 'utf8'), before);
});

test('showcase: 산출물 전무 시 명확히 실패', () => {
  const d = mkdtempSync(join(tmpdir(), 'showcase-empty-'));
  mkdirSync(join(d, '.design'), { recursive: true });
  writeFileSync(join(d, '.design/tokens.json'), JSON.stringify(TOKENS));
  assert.throws(() => execFileSync('node', [SCRIPT, d], { stdio: 'pipe' }));
});
