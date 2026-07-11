import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = 'brand-studio/scripts/og-render.mjs';

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

const BRAND = {
  $schema: 'brand-studio/brand-v1',
  meta: { project: 'Fixture Brand', updated: '2026-07-12' },
  brief: { keywords: ['modern', 'friendly', 'bold'] },
  decisions: { logoType: 'wordmark' },
  logo: { svg: '.design/brand/logo/logo.svg', variants: [], clearspace: '0.5x', minSizePx: 24 },
  applications: { og: { slogan: '기본 슬로건' } },
  progress: { phase: 'applications' },
};

// 조판(미팅 4 산출물) 픽스처 — {{TITLE}}/{{SLOGAN}} 플레이스홀더 규약
const TEMPLATE = `<div class="og-card" style="width:1200px;height:630px;background:#0046FF;color:#ffffff">
  <h1 class="og-title">{{TITLE}}</h1>
  <p class="og-slogan">{{SLOGAN}}</p>
</div>`;

function makeProject() {
  const dir = mkdtempSync(join(tmpdir(), 'og-'));
  mkdirSync(join(dir, '.design', 'brand', 'logo'), { recursive: true });
  writeFileSync(join(dir, '.design', 'tokens.json'), JSON.stringify(TOKENS));
  writeFileSync(join(dir, '.design', 'brand.json'), JSON.stringify(BRAND));
  return dir;
}

function withTemplate(dir) {
  writeFileSync(join(dir, '.design', 'brand', 'og-template.html'), TEMPLATE);
  return dir;
}

function capturePath(dir) {
  return join(dir, '.design', 'brand', '_og-capture.html');
}

test('{{TITLE}}/{{SLOGAN}} 치환 + XSS 이스케이프', () => {
  const dir = withTemplate(makeProject());
  execFileSync('node', [SCRIPT, dir, '--title', '<script>alert(1)</script>', '--slogan', 'A & B "C"']);
  const html = readFileSync(capturePath(dir), 'utf8');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'title XSS 이스케이프 안 됨');
  assert.ok(!html.includes('<script>alert(1)</script>'), '원본 스크립트 태그가 그대로 남음');
  assert.ok(html.includes('A &amp; B &quot;C&quot;'), 'slogan 이스케이프 안 됨');
});

test('--title 누락 → exit 1', () => {
  const dir = withTemplate(makeProject());
  assert.throws(() => execFileSync('node', [SCRIPT, dir], { stdio: 'pipe' }));
});

test('같은 인자 2회 실행 → 바이트 동일(결정성)', () => {
  const dir = withTemplate(makeProject());
  const args = [SCRIPT, dir, '--title', '제목입니다', '--slogan', '슬로건'];
  execFileSync('node', args);
  const first = readFileSync(capturePath(dir), 'utf8');
  execFileSync('node', args);
  const second = readFileSync(capturePath(dir), 'utf8');
  assert.strictEqual(first, second);
});

test('og-template.html 없으면 "미팅 4를 먼저" 안내 + exit 1', () => {
  const dir = makeProject(); // 템플릿 미생성
  let error;
  try {
    execFileSync('node', [SCRIPT, dir, '--title', '제목'], { stdio: 'pipe' });
  } catch (e) { error = e; }
  assert.ok(error, '템플릿 없을 때 실패해야 함');
  assert.strictEqual(error.status, 1);
  assert.ok(error.stderr.toString('utf8').includes('미팅 4를 먼저'));
});

test('--slogan 생략 시 brand.json applications.og.slogan 사용', () => {
  const dir = withTemplate(makeProject());
  execFileSync('node', [SCRIPT, dir, '--title', '제목']);
  const html = readFileSync(capturePath(dir), 'utf8');
  assert.ok(html.includes('기본 슬로건'));
});

test('--slogan 생략 + brand.json에도 없으면 빈 문자열', () => {
  const dir = withTemplate(makeProject());
  const brand = JSON.parse(readFileSync(join(dir, '.design', 'brand.json'), 'utf8'));
  delete brand.applications;
  writeFileSync(join(dir, '.design', 'brand.json'), JSON.stringify(brand));
  execFileSync('node', [SCRIPT, dir, '--title', '제목']);
  const html = readFileSync(capturePath(dir), 'utf8');
  assert.ok(html.includes('<p class="og-slogan"></p>'));
});

test('1200x630 캡처 박스(id="cap-og") 존재', () => {
  const dir = withTemplate(makeProject());
  execFileSync('node', [SCRIPT, dir, '--title', '제목']);
  const html = readFileSync(capturePath(dir), 'utf8');
  const m = html.match(/<div id="cap-og"[^>]*style="([^"]*)"/);
  assert.ok(m, 'cap-og 박스를 찾지 못함');
  assert.ok(/width:\s*1200px/.test(m[1]));
  assert.ok(/height:\s*630px/.test(m[1]));
});

test('stdout JSON — capturePath/targetPng/size, --out 기본값 og', () => {
  const dir = withTemplate(makeProject());
  const out = JSON.parse(execFileSync('node', [SCRIPT, dir, '--title', '제목'], { encoding: 'utf8' }));
  assert.strictEqual(out.capturePath, capturePath(dir));
  assert.strictEqual(out.targetPng, join(dir, '.design', 'brand', 'social', 'og.png'));
  assert.strictEqual(out.size, '1200x630');
});

test('stdout JSON — --out 지정 시 targetPng 파일명 반영', () => {
  const dir = withTemplate(makeProject());
  const out = JSON.parse(execFileSync('node', [SCRIPT, dir, '--title', '제목', '--out', 'og-post-slug'], { encoding: 'utf8' }));
  assert.strictEqual(out.targetPng, join(dir, '.design', 'brand', 'social', 'og-post-slug.png'));
});
