import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, mkdtempSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { packIco } from '../brand-studio/scripts/asset-expand.mjs';

const SCRIPT = 'brand-studio/scripts/asset-expand.mjs';
const PNG_1PX_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

// pngSize(brand.mjs)는 IHDR 폭/높이 바이트만 읽으므로, 서명+IHDR 폭·높이만 채운 최소 픽스처로 충분
function fakePng(w, h) {
  const buf = Buffer.alloc(33);
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);   // PNG 서명
  buf.write('IHDR', 12);
  buf.writeUInt32BE(w, 16);
  buf.writeUInt32BE(h, 20);
  return buf;
}

const REQUIRED_IDS = [
  ['favicon-16', 16, 16], ['favicon-32', 32, 32], ['favicon-48', 48, 48],
  ['apple-touch-180', 180, 180], ['icon-192', 192, 192], ['icon-512', 512, 512],
  ['maskable-512', 512, 512], ['og-1200x630', 1200, 630], ['profile-800', 800, 800],
  ['x-cover', 1500, 500], ['youtube-cover', 2048, 1152], ['linkedin-cover', 1128, 191],
];

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
  assets: { favicon: { simplified: true }, details: [] },
  progress: { phase: 'system' },
};

const LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#0046FF"/></svg>';

function makeProject() {
  const dir = mkdtempSync(join(tmpdir(), 'expand-'));
  mkdirSync(join(dir, '.design', 'brand', 'logo'), { recursive: true });
  writeFileSync(join(dir, '.design', 'tokens.json'), JSON.stringify(TOKENS));
  writeFileSync(join(dir, '.design', 'brand.json'), JSON.stringify(BRAND));
  writeFileSync(join(dir, '.design', 'brand', 'logo', 'logo.svg'), LOGO_SVG);
  return dir;
}

test('packIco — ICONDIR 헤더·엔트리·오프셋·PNG 시그니처 재검증', () => {
  const png = Buffer.from(PNG_1PX_B64, 'base64');
  const sizes = [16, 32, 48];
  const ico = packIco(sizes.map(size => ({ size, buf: png })));

  assert.strictEqual(ico.readUInt16LE(0), 0);       // reserved
  assert.strictEqual(ico.readUInt16LE(2), 1);        // type = icon
  assert.strictEqual(ico.readUInt16LE(4), sizes.length);

  let offset = 6 + 16 * sizes.length;
  sizes.forEach((size, i) => {
    const e = 6 + i * 16;
    assert.strictEqual(ico.readUInt8(e), size);
    assert.strictEqual(ico.readUInt8(e + 1), size);
    assert.strictEqual(ico.readUInt16LE(e + 4), 1);   // planes
    assert.strictEqual(ico.readUInt16LE(e + 6), 32);  // bitcount
    assert.strictEqual(ico.readUInt32LE(e + 8), png.length);
    assert.strictEqual(ico.readUInt32LE(e + 12), offset);
    assert.deepStrictEqual(ico.subarray(offset, offset + 4), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    offset += png.length;
  });
  assert.strictEqual(ico.length, offset);
});

test('packIco — size 256 이상은 엔트리 0으로 표기(ICO 스펙)', () => {
  const png = Buffer.from(PNG_1PX_B64, 'base64');
  const ico = packIco([{ size: 256, buf: png }]);
  assert.strictEqual(ico.readUInt8(6), 0);
  assert.strictEqual(ico.readUInt8(7), 0);
});

test('_capture.html — 결정적(2회 실행 바이트 동일) + 필수 캡처 id 전부 존재', () => {
  const dir = makeProject();
  execFileSync('node', [SCRIPT, dir]);
  const first = readFileSync(join(dir, '.design', 'brand', '_capture.html'), 'utf8');
  execFileSync('node', [SCRIPT, dir]);
  const second = readFileSync(join(dir, '.design', 'brand', '_capture.html'), 'utf8');
  assert.strictEqual(first, second);

  for (const [id] of REQUIRED_IDS) {
    assert.ok(first.includes(`id="cap-${id}"`), `캡처 id 누락: ${id}`);
  }
});

test('_capture.html — maskable-512 박스는 512x512', () => {
  const dir = makeProject();
  execFileSync('node', [SCRIPT, dir]);
  const html = readFileSync(join(dir, '.design', 'brand', '_capture.html'), 'utf8');
  const m = html.match(/<div id="cap-maskable-512"[^>]*style="([^"]*)"/);
  assert.ok(m, 'maskable-512 박스를 찾지 못함');
  assert.ok(/width:\s*512px/.test(m[1]));
  assert.ok(/height:\s*512px/.test(m[1]));
});

test('기본 모드 — icons/favicon.svg·safari-pinned-tab.svg·manifest.webmanifest 즉시 생성 + stdout JSON', () => {
  const dir = makeProject();
  const out = JSON.parse(execFileSync('node', [SCRIPT, dir], { encoding: 'utf8' }));
  assert.strictEqual(out.captures.length, REQUIRED_IDS.length);
  assert.ok(out.written.length >= 4);

  const brandDir = join(dir, '.design', 'brand');
  assert.ok(existsSync(join(brandDir, 'icons', 'favicon.svg')));
  const safari = readFileSync(join(brandDir, 'icons', 'safari-pinned-tab.svg'), 'utf8');
  assert.ok(!safari.includes('#0046FF'), 'safari-pinned-tab은 단색화되어야 함');
  const manifest = JSON.parse(readFileSync(join(brandDir, 'icons', 'manifest.webmanifest'), 'utf8'));
  assert.strictEqual(manifest.name, BRAND.meta.project);
  assert.strictEqual(manifest.theme_color, TOKENS.color.primary);
});

test('--pack-ico — 캡처 PNG 없으면 exit 1("캡처 먼저")', () => {
  const dir = makeProject();
  execFileSync('node', [SCRIPT, dir]);   // 캡처 페이지만 생성, PNG는 없음
  assert.throws(() => execFileSync('node', [SCRIPT, dir, '--pack-ico'], { stdio: 'pipe' }),
    /캡처 먼저/);
});

test('--pack-ico — favicon-16/32/48.png → favicon.ico 패킹', () => {
  const dir = makeProject();
  execFileSync('node', [SCRIPT, dir]);
  const iconsDir = join(dir, '.design', 'brand', 'icons');
  for (const size of [16, 32, 48]) {
    writeFileSync(join(iconsDir, `favicon-${size}.png`), fakePng(size, size));
  }
  const out = JSON.parse(execFileSync('node', [SCRIPT, dir, '--pack-ico'], { encoding: 'utf8' }));
  assert.ok(out.written.some(p => p.endsWith('favicon.ico')));
  const ico = readFileSync(join(iconsDir, 'favicon.ico'));
  assert.strictEqual(ico.readUInt16LE(4), 3);   // 3프레임
});

test('--verify — 전부 정확한 치수 → ok', () => {
  const dir = makeProject();
  execFileSync('node', [SCRIPT, dir]);
  const brandDir = join(dir, '.design', 'brand');
  const out = JSON.parse(execFileSync('node', [SCRIPT, dir], { encoding: 'utf8' }));
  for (const c of out.captures) {
    const target = join(brandDir, c.target);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, fakePng(c.size.w, c.size.h));
  }
  const result = JSON.parse(execFileSync('node', [SCRIPT, dir, '--verify'], { encoding: 'utf8' }));
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.verified, REQUIRED_IDS.length);
});

test('--verify — 치수 틀린 픽스처 PNG → exit 1 + 불일치 목록', () => {
  const dir = makeProject();
  const out = JSON.parse(execFileSync('node', [SCRIPT, dir], { encoding: 'utf8' }));
  const brandDir = join(dir, '.design', 'brand');
  for (const c of out.captures) {
    const target = join(brandDir, c.target);
    mkdirSync(join(target, '..'), { recursive: true });
    const wrong = c.id === 'favicon-32';
    writeFileSync(target, fakePng(wrong ? c.size.w - 2 : c.size.w, c.size.h));
  }
  let error;
  try {
    execFileSync('node', [SCRIPT, dir, '--verify'], { stdio: 'pipe' });
  } catch (e) { error = e; }
  assert.ok(error, '--verify는 치수 불일치 시 실패해야 함');
  assert.strictEqual(error.status, 1);
  const body = error.stderr.toString('utf8') + error.stdout.toString('utf8');
  assert.ok(body.includes('favicon-32'));
});

test('--verify — 캡처 파일 자체가 없으면 exit 1', () => {
  const dir = makeProject();
  execFileSync('node', [SCRIPT, dir]);   // captures.json 생성 안 됨(파일 미존재)
  assert.throws(() => execFileSync('node', [SCRIPT, dir, '--verify'], { stdio: 'pipe' }));
});

test('logo.favicon 지정 시 — 파비콘 계열(캡처+icons/favicon.svg+safari-pinned-tab)은 재작도본, 나머지는 logo.svg 유지', () => {
  const dir = makeProject();
  const FAVICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#FF0000"/></svg>';
  writeFileSync(join(dir, '.design', 'brand', 'logo', 'favicon.svg'), FAVICON_SVG);
  const brand = JSON.parse(readFileSync(join(dir, '.design', 'brand.json'), 'utf8'));
  brand.logo.favicon = '.design/brand/logo/favicon.svg';
  writeFileSync(join(dir, '.design', 'brand.json'), JSON.stringify(brand));

  execFileSync('node', [SCRIPT, dir]);
  const brandDir = join(dir, '.design', 'brand');
  const html = readFileSync(join(brandDir, '_capture.html'), 'utf8');
  const faviconB64 = Buffer.from(FAVICON_SVG, 'utf8').toString('base64');
  const logoB64 = Buffer.from(LOGO_SVG, 'utf8').toString('base64');

  for (const id of ['favicon-16', 'favicon-32', 'favicon-48']) {
    const m = html.match(new RegExp(`<div id="cap-${id}"[^>]*>[\\s\\S]*?<img src="([^"]*)"`));
    assert.ok(m, `캡처 박스 없음: ${id}`);
    assert.ok(m[1].includes(faviconB64), `${id}가 재작도된 favicon.svg를 쓰지 않음`);
  }
  for (const id of ['apple-touch-180', 'icon-192', 'icon-512']) {
    const m = html.match(new RegExp(`<div id="cap-${id}"[^>]*>[\\s\\S]*?<img src="([^"]*)"`));
    assert.ok(m, `캡처 박스 없음: ${id}`);
    assert.ok(m[1].includes(logoB64), `${id}는 계속 logo.svg를 써야 함`);
  }

  const iconsFaviconSvg = readFileSync(join(brandDir, 'icons', 'favicon.svg'), 'utf8');
  assert.strictEqual(iconsFaviconSvg, FAVICON_SVG, 'icons/favicon.svg는 재작도본을 써야 함');

  const safari = readFileSync(join(brandDir, 'icons', 'safari-pinned-tab.svg'), 'utf8');
  assert.ok(!safari.includes('#FF0000'), 'safari-pinned-tab은 단색화되어야 함');
  assert.ok(!safari.includes('#0046FF'), 'safari-pinned-tab이 logo.svg 기반이면 안 됨');
});

test('logo.favicon 미지정 시 — 기존 동작(파비콘 계열도 logo.svg 사용) 유지', () => {
  const dir = makeProject();
  execFileSync('node', [SCRIPT, dir]);
  const brandDir = join(dir, '.design', 'brand');
  const html = readFileSync(join(brandDir, '_capture.html'), 'utf8');
  const logoB64 = Buffer.from(LOGO_SVG, 'utf8').toString('base64');

  for (const id of ['favicon-16', 'favicon-32', 'favicon-48']) {
    const m = html.match(new RegExp(`<div id="cap-${id}"[^>]*>[\\s\\S]*?<img src="([^"]*)"`));
    assert.ok(m, `캡처 박스 없음: ${id}`);
    assert.ok(m[1].includes(logoB64), `${id}는 logo.svg를 써야 함(미지정 시 하위호환)`);
  }
  const iconsFaviconSvg = readFileSync(join(brandDir, 'icons', 'favicon.svg'), 'utf8');
  assert.strictEqual(iconsFaviconSvg, LOGO_SVG, 'logo.favicon 미지정 시 icons/favicon.svg는 logo.svg와 동일해야 함');
});
