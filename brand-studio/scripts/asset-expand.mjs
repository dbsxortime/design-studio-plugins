#!/usr/bin/env node
/* 확정 로고 SVG → 캡처 페이지 생성 · favicon.ico 패킹 · 산출물 치수 검증.
   3 CLI 모드(스킬이 이 순서대로 호출):
   node asset-expand.mjs <프로젝트>              — 캡처 페이지 + favicon.svg·safari-pinned-tab.svg·manifest 즉시 생성
   node asset-expand.mjs <프로젝트> --pack-ico    — favicon-16/32/48.png → favicon.ico 패킹
   node asset-expand.mjs <프로젝트> --verify      — 캡처 목록 기준 대상 PNG 존재+치수 검증
   외부 이미지 라이브러리 의존 0 — ICO 패킹은 순수 JS로 ICONDIR 컨테이너를 직접 조립. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateBrand, toMono, maskableWrap, deriveManifest, pngSize } from './lib/brand.mjs';

/* ICONDIR(6B) + ICONDIRENTRY(16B×n) + PNG 데이터 연결. PNG-in-ICO는 Vista+ 표준 */
export function packIco(pngs) {              // pngs: [{size, buf}]
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  const entries = [], bodies = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);   // 256은 0으로 표기
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12);
    entries.push(e); bodies.push(buf); offset += buf.length;
  }
  return Buffer.concat([head, ...entries, ...bodies]);
}

/* 필수 캡처 목록 — id·치수·target(브랜드 디렉토리 기준 상대경로) 고정 순서.
   manifest.webmanifest는 deriveManifest의 아이콘 src(icon-192.png 등)가 접두 없는 파일명이므로
   같은 디렉토리(icons/)에 두어야 매니페스트-아이콘 상대참조가 실제로 유효하다. */
const CAPTURES = [
  { id: 'favicon-16', w: 16, h: 16, target: 'icons/favicon-16.png' },
  { id: 'favicon-32', w: 32, h: 32, target: 'icons/favicon-32.png' },
  { id: 'favicon-48', w: 48, h: 48, target: 'icons/favicon-48.png' },
  { id: 'apple-touch-180', w: 180, h: 180, target: 'icons/apple-touch-icon.png' },
  { id: 'icon-192', w: 192, h: 192, target: 'icons/icon-192.png' },
  { id: 'icon-512', w: 512, h: 512, target: 'icons/icon-512.png' },
  { id: 'maskable-512', w: 512, h: 512, target: 'icons/icon-512-maskable.png' },
  { id: 'og-1200x630', w: 1200, h: 630, target: 'og.png' },
  { id: 'profile-800', w: 800, h: 800, target: 'social/profile.png' },
  { id: 'x-cover', w: 1500, h: 500, target: 'social/x-cover.png' },
  { id: 'youtube-cover', w: 2048, h: 1152, target: 'social/youtube-cover.png' },
  { id: 'linkedin-cover', w: 1128, h: 191, target: 'social/linkedin-cover.png' },
];
const ICON_IDS = new Set(['favicon-16', 'favicon-32', 'favicon-48', 'apple-touch-180', 'icon-192', 'icon-512']);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function dataUri(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

/* 아이콘류 박스 — 흰 배경 위 로고를 object-fit:contain으로 채움 */
function iconBox(id, w, h, svg) {
  return `  <div id="cap-${id}" class="cap" style="width:${w}px;height:${h}px;background:#ffffff">` +
    `<img src="${dataUri(svg)}" alt=""/></div>`;
}

/* og/소셜 커버류 박스 — 토큰 primary 배경 + 로고 + 프로젝트명(실제 조판은 T5 og-template로 대체, 캡처 슬롯만 확보) */
function coverBox(id, w, h, svg, projectName, tokens) {
  const fontSize = Math.round(Math.min(w, h) * 0.12);
  return `  <div id="cap-${id}" class="cap cover" style="width:${w}px;height:${h}px;background:${tokens.color.primary}">` +
    `<img src="${dataUri(svg)}" alt="" class="cover-logo"/>` +
    `<span style="font-family:'${tokens.font.family}',sans-serif;font-weight:${tokens.font.headingWeight ?? 700};` +
    `color:${tokens.color.onPrimary ?? '#ffffff'};font-size:${fontSize}px">${escapeHtml(projectName)}</span></div>`;
}

const FAVICON_IDS = new Set(['favicon-16', 'favicon-32', 'favicon-48']);

/* faviconSvg는 brand.logo.favicon(재작도본)이 있으면 그것, 없으면 logoSvg와 동일(하위호환) */
function buildCapturePage(brand, tokens, logoSvg, faviconSvg) {
  const maskSvg = maskableWrap(logoSvg, 512, tokens.color.bg ?? '#ffffff');
  const boxes = CAPTURES.map(c => {
    if (c.id === 'maskable-512') return iconBox(c.id, c.w, c.h, maskSvg);
    if (FAVICON_IDS.has(c.id)) return iconBox(c.id, c.w, c.h, faviconSvg);
    if (ICON_IDS.has(c.id)) return iconBox(c.id, c.w, c.h, logoSvg);
    return coverBox(c.id, c.w, c.h, logoSvg, brand.meta.project, tokens);
  }).join('\n');

  return `<!--
캡처 규약(asset-expand.mjs 계약 — /brand SKILL이 그대로 소비):
각 <div id="cap-<capture-id>">가 목표 픽셀 크기와 정확히 일치하는 박스(overflow:hidden). playwright MCP로
이 페이지를 열고 요소 스크린샷(browser_take_screenshot)을 찍어 id별로 대응하는 target 경로(asset-expand.mjs
--verify가 참조하는 CAPTURES 목록의 target)에 PNG로 저장한다. 박스가 곧 최종 산출물 프레임이다.
-->
<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:#ffffff}
  .cap{overflow:hidden;position:relative;box-sizing:border-box}
  .cap img{display:block;width:100%;height:100%;object-fit:contain}
  .cap.cover{display:flex;align-items:center;justify-content:center;gap:24px}
  .cap.cover img.cover-logo{width:auto;height:40%;object-fit:contain}
</style></head>
<body>
${boxes}
</body></html>
`;
}

// ── CLI (직접 실행될 때만 동작 — import 시 packIco만 재사용) ──
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

function main() {
  const args = process.argv.slice(2);
  const dir = args.find(a => !a.startsWith('--')) || '.';
  const mode = args.includes('--pack-ico') ? 'pack-ico' : args.includes('--verify') ? 'verify' : 'default';

  const brandPath = join(dir, '.design', 'brand.json');
  if (!existsSync(brandPath)) {
    console.error('.design/brand.json 필요 — /brand로 브리프부터 진행'); process.exit(1);
  }
  const brand = JSON.parse(readFileSync(brandPath, 'utf8'));
  const bv = validateBrand(brand);
  if (!bv.ok) { console.error('brand.json 검증 실패:\n- ' + bv.errors.join('\n- ')); process.exit(1); }

  const tokensPath = join(dir, '.design', 'tokens.json');
  if (!existsSync(tokensPath)) {
    console.error('.design/tokens.json 필요 — /design-tokens로 기준부터 확보'); process.exit(1);
  }
  const tokens = JSON.parse(readFileSync(tokensPath, 'utf8'));

  const brandDir = join(dir, '.design', 'brand');
  const iconsDir = join(brandDir, 'icons');

  if (mode === 'pack-ico') {
    const sizes = [16, 32, 48];
    const missing = sizes.filter(s => !existsSync(join(iconsDir, `favicon-${s}.png`)));
    if (missing.length) {
      console.error(`icons/favicon-${missing.join('/')}.png 없음 — 캡처 먼저(node asset-expand.mjs ${dir})`);
      process.exit(1);
    }
    const pngs = sizes.map(size => ({ size, buf: readFileSync(join(iconsDir, `favicon-${size}.png`)) }));
    const icoPath = join(iconsDir, 'favicon.ico');
    writeFileSync(icoPath, packIco(pngs));
    console.log(JSON.stringify({ written: [icoPath] }, null, 2));
    process.exit(0);
  }

  if (mode === 'verify') {
    const mismatches = [];
    for (const c of CAPTURES) {
      const target = join(brandDir, c.target);
      if (!existsSync(target)) { mismatches.push({ id: c.id, target: c.target, reason: 'missing' }); continue; }
      const { w, h } = pngSize(readFileSync(target));
      if (w !== c.w || h !== c.h) {
        mismatches.push({ id: c.id, target: c.target, expected: { w: c.w, h: c.h }, actual: { w, h } });
      }
    }
    if (mismatches.length) {
      console.error(JSON.stringify({ ok: false, mismatches }, null, 2));
      process.exit(1);
    }
    console.log(JSON.stringify({ ok: true, verified: CAPTURES.length }, null, 2));
    process.exit(0);
  }

  // 기본 모드
  const logoPath = join(dir, brand.logo.svg);
  if (!existsSync(logoPath)) { console.error(`로고 SVG 없음: ${brand.logo.svg}`); process.exit(1); }
  const logoSvg = readFileSync(logoPath, 'utf8');

  // brand.logo.favicon(선택) — 재작도본이 실재하면 파비콘 계열(favicon-16/32/48·icons/favicon.svg·
  // safari-pinned-tab.svg)에 사용. 없으면 logoSvg로 대체(하위호환)
  let faviconSvg = logoSvg;
  if (brand.logo.favicon) {
    const faviconPath = join(dir, brand.logo.favicon);
    if (existsSync(faviconPath)) faviconSvg = readFileSync(faviconPath, 'utf8');
  }

  mkdirSync(iconsDir, { recursive: true });
  mkdirSync(join(brandDir, 'social'), { recursive: true });

  const written = [];

  const capturePath = join(brandDir, '_capture.html');
  writeFileSync(capturePath, buildCapturePage(brand, tokens, logoSvg, faviconSvg));
  written.push(capturePath);

  const faviconSvgPath = join(iconsDir, 'favicon.svg');
  writeFileSync(faviconSvgPath, faviconSvg);
  written.push(faviconSvgPath);

  const safariPath = join(iconsDir, 'safari-pinned-tab.svg');
  writeFileSync(safariPath, toMono(faviconSvg, '#000000'));
  written.push(safariPath);

  const manifestPath = join(iconsDir, 'manifest.webmanifest');
  writeFileSync(manifestPath, JSON.stringify(deriveManifest(brand, tokens), null, 2) + '\n');
  written.push(manifestPath);

  console.log(JSON.stringify({
    captures: CAPTURES.map(c => ({ id: c.id, size: { w: c.w, h: c.h }, target: c.target })),
    written,
  }, null, 2));
}
