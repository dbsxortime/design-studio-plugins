#!/usr/bin/env node
/* 시안 보드 + 브랜드북 조립.
   2 CLI 모드:
   node brand-board.mjs <프로젝트> --board <svg1> <svg2> <svg3> [--label 라운드1]
     → .design/brand/_board.html — 시안 3안을 라이트/다크/32px 3맥락으로 나란히 렌더
   node brand-board.mjs <프로젝트> --brandbook
     → .design/brand/brandbook.html — 6축 조립(로고 시스템·색·타이포·그래픽 언어·적용 자산·모션/디테일)
   외부 요청 0, 산출 결정적(타임스탬프 금지) — 스타일은 인라인 CSS 단일 HTML. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { validateBrand, deriveDetailsCss } from './lib/brand.mjs';
import { contrastOn } from '../../design-check/scripts/lib/tokens.mjs';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function dataUri(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

// ── --board ──
function boardBox(svg, w, h, bg, extraClass) {
  return `    <div class="board-box ${extraClass}" style="width:${w}px;height:${h}px;background:${bg}">` +
    `<img src="${dataUri(svg)}" alt=""/></div>`;
}

function buildBoardPage(brand, svgContents, label) {
  const heading = label
    ? `${escapeHtml(brand.meta.project)} — 시안 보드 (${escapeHtml(label)})`
    : `${escapeHtml(brand.meta.project)} — 시안 보드`;

  const candidates = svgContents.map((svg, i) => {
    const n = i + 1;
    return `  <section class="board-candidate" id="board-candidate-${n}">
    <h3>안 ${n}</h3>
    <div class="board-row">
${boardBox(svg, 240, 240, '#ffffff', 'board-light')}
${boardBox(svg, 240, 240, '#111111', 'board-dark')}
${boardBox(svg, 32, 32, '#ffffff', 'board-32')}
    </div>
  </section>`;
  }).join('\n');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${heading}</title><style>
  html,body{margin:0;padding:24px;background:#f4f5f7;font-family:sans-serif;color:#111111}
  h1{font-size:20px} h3{font-size:14px;margin:0 0 8px}
  .board-candidate{margin-bottom:32px}
  .board-row{display:flex;gap:16px;align-items:flex-end}
  .board-box{display:flex;align-items:center;justify-content:center;overflow:hidden;box-sizing:border-box;border:1px solid #dddddd}
  .board-box img{width:80%;height:80%;object-fit:contain}
</style></head>
<body>
<h1>${heading}</h1>
${candidates}
</body></html>
`;
}

// ── --brandbook (6축) ──
function logoSystemSection(brand, tokens, logoSvg) {
  const { clearspace, minSizePx, variants = [] } = brand.logo;
  const factor = parseFloat(clearspace) || 1;
  const pad = Math.round(40 * factor);
  const variantTags = variants.length
    ? variants.map(v => `<span class="tag">${escapeHtml(v)}</span>`).join('')
    : '<p class="unset">등록된 변형 없음</p>';

  return `<section><h2>로고 시스템</h2>
  <h3>변형</h3>
  <div class="variant-list">${variantTags}</div>
  <h3>세이프존</h3>
  <div class="safezone-box" style="padding:${pad}px;border:1px dashed ${tokens.color.muted}">
    <img src="${dataUri(logoSvg)}" alt="logo" style="width:80px;height:80px"/>
  </div>
  <p class="caption">로고 사방 ${escapeHtml(clearspace)} 여백 확보</p>
  <h3>최소 크기</h3>
  <div class="minsize-box" style="width:${minSizePx}px;height:${minSizePx}px">
    <img src="${dataUri(logoSvg)}" alt="logo"/>
  </div>
  <p class="caption">최소 ${minSizePx}px 이상에서 사용</p>
  <h3>Do / Don't</h3>
  <ul class="donts">
    <li>로고 비율을 임의로 늘이거나 줄이지 않는다</li>
    <li>로고를 회전시키지 않는다</li>
    <li>로고 색상을 임의로 변경하지 않는다</li>
    <li>저대비 배경 위에 로고를 배치하지 않는다</li>
  </ul>
</section>`;
}

function colorSection(tokens) {
  const onPrimary = tokens.color.onPrimary || contrastOn(tokens.color.primary);
  const entries = [
    ['primary', tokens.color.primary], ['onPrimary', onPrimary],
    ['bg', tokens.color.bg], ['surface', tokens.color.surface],
    ['text', tokens.color.text], ['muted', tokens.color.muted],
  ];
  const swatches = entries.map(([name, hex]) =>
    `<div class="swatch"><div class="swatch-color" style="background:${hex}"></div><span>${name} ${hex}</span></div>`
  ).join('');
  return `<section><h2>색</h2><div class="swatch-row">${swatches}</div></section>`;
}

function typographySection(brand, tokens) {
  const f = tokens.font;
  return `<section><h2>타이포</h2>
  <div class="type-sample" style="font-family:'${escapeHtml(f.family)}',sans-serif">
    <p style="font-size:32px;font-weight:${f.headingWeight ?? 700};margin:0 0 4px">${escapeHtml(brand.meta.project)}</p>
    <p style="font-size:${f.bodySize ?? '14px'};margin:0">${escapeHtml(brand.brief.keywords.join(' · '))}</p>
  </div>
  <p class="caption">${escapeHtml(f.family)} · heading ${f.headingWeight ?? 700} · body ${f.bodySize ?? '14px'}</p>
</section>`;
}

/* 패턴은 배경용 저대비(surface 톤) SVG라 surface 타일 배경과 겹치면 안 보인다.
   실제 쓰임새(배경 반복 타일)처럼 tokens.color.bg 위에 background-image로 반복 렌더 */
function patternTile(name, brandDir, tokens) {
  const relPath = `graphics/${name}`;
  const abs = join(brandDir, relPath);
  const inner = existsSync(abs) ? '' : escapeHtml(name);
  const bgImage = existsSync(abs) ? `;background-image:url('${relPath}')` : '';
  return `<div class="graphics-tile pattern-tile" style="background-color:${tokens.color.bg}${bgImage}">${inner}</div>`;
}

// 셰이프는 로고 부분 요소 — 기존과 동일하게 surface 배경 위 인라인 img
function shapeTile(name, brandDir, tokens) {
  const abs = join(brandDir, 'graphics', name);
  const inner = existsSync(abs)
    ? `<img src="${dataUri(readFileSync(abs, 'utf8'))}" alt="${escapeHtml(name)}"/>`
    : escapeHtml(name);
  return `<div class="graphics-tile" style="background:${tokens.color.surface}">${inner}</div>`;
}

// patterns/shapes는 brand.json에 파일명만 명시됨(§6) — .design/brand/graphics/<name> 실존 시 삽입, 아니면 이름 타일
function graphicsSection(brand, tokens, brandDir) {
  const patterns = brand.graphics?.patterns ?? [];
  const shapes = brand.graphics?.shapes ?? [];
  if (!patterns.length && !shapes.length) {
    return `<section><h2>그래픽 언어</h2><p class="unset">미정</p></section>`;
  }
  const grid = [
    ...patterns.map(name => patternTile(name, brandDir, tokens)),
    ...shapes.map(name => shapeTile(name, brandDir, tokens)),
  ].join('');
  const note = brand.graphics.motifNote ? `<p class="caption">${escapeHtml(brand.graphics.motifNote)}</p>` : '';
  return `<section><h2>그래픽 언어</h2><div class="graphics-grid">${grid}</div>${note}</section>`;
}

function assetOrPlaceholder(brandDir, relPath, cssClass, label) {
  const abs = join(brandDir, relPath);
  return existsSync(abs)
    ? `<img class="${cssClass}" src="${relPath}" alt="${escapeHtml(label)}"/>`
    : `<div class="${cssClass} placeholder">${escapeHtml(label)} 없음</div>`;
}

function appliedAssetsSection(brand, brandDir) {
  const favicon = assetOrPlaceholder(brandDir, 'icons/favicon.svg', 'mockup-favicon', 'favicon');
  const og = assetOrPlaceholder(brandDir, 'og.png', 'mockup-og', 'OG 이미지');
  return `<section><h2>적용 자산</h2>
  <div class="mockup-row">
    <div class="mockup-browser">
      <div class="mockup-tab">${favicon}<span class="mockup-tab-title">${escapeHtml(brand.meta.project)}</span></div>
      <div class="mockup-url-bar"></div>
    </div>
    <div class="mockup-card">
      ${og}
      <div class="mockup-card-body"><div class="mockup-card-title">${escapeHtml(brand.meta.project)}</div></div>
    </div>
  </div>
</section>`;
}

// 활성 디테일 목록은 deriveDetailsCss(lib/brand.mjs)의 /* detail:<id> */ 마커에서 파생 — 로직 중복 없음
function motionSection(brand, tokens) {
  const css = deriveDetailsCss(tokens, brand);
  const activeIds = [...css.matchAll(/\/\* detail:([\w-]+) \*\//g)].map(m => m[1]);
  const anim = brand.motion?.logoAnim ?? '미정';
  const [k1, k2, k3] = brand.brief.keywords;
  const styleGuide = `이 브랜드의 일러스트는 ${k1}·${k2}·${k3}의 톤을 유지하며, ` +
    `브랜드 팔레트 색상만 사용하고 과도한 디테일 없이 단순한 형태로 표현한다.`;

  return `<section><h2>모션·디테일</h2>
  <h3>활성 디테일</h3>
  <ul>${activeIds.map(id => `<li>${escapeHtml(id)}</li>`).join('')}</ul>
  <h3>로고 모션</h3>
  <p>${escapeHtml(String(anim))}</p>
  <h3>일러스트 스타일 가이드</h3>
  <p>${escapeHtml(styleGuide)}</p>
</section>`;
}

function bookCss(tokens) {
  return `
  html,body{margin:0;padding:24px;background:${tokens.color.bg};color:${tokens.color.text};font-family:'${tokens.font.family}',sans-serif}
  h1{font-size:22px;margin:0 0 24px}
  h2{font-size:18px;border-bottom:2px solid ${tokens.color.primary};padding-bottom:4px;margin-top:40px}
  h3{font-size:13px;color:${tokens.color.muted};margin:16px 0 8px;text-transform:uppercase;letter-spacing:.04em}
  .caption{font-size:12px;color:${tokens.color.muted}}
  .unset{color:${tokens.color.muted};font-style:italic}
  .tag{display:inline-block;background:${tokens.color.surface};border-radius:${tokens.radius.pill};padding:2px 10px;margin:0 4px 4px 0;font-size:12px}
  .variant-list{display:flex;flex-wrap:wrap}
  .safezone-box,.minsize-box{display:inline-flex;align-items:center;justify-content:center;background:${tokens.color.surface}}
  .donts{margin:0;padding-left:20px}
  .swatch-row{display:flex;gap:16px;flex-wrap:wrap}
  .swatch{display:flex;flex-direction:column;align-items:center;font-size:12px;gap:4px}
  .swatch-color{width:56px;height:56px;border-radius:${tokens.radius.base};border:1px solid ${tokens.color.muted}}
  .type-sample{background:${tokens.color.surface};border-radius:${tokens.radius.card};padding:16px}
  .graphics-grid{display:flex;gap:12px;flex-wrap:wrap}
  .graphics-tile{width:96px;height:96px;display:flex;align-items:center;justify-content:center;font-size:11px;text-align:center;border-radius:${tokens.radius.base};overflow:hidden}
  .graphics-tile img{width:100%;height:100%;object-fit:contain}
  .graphics-tile.pattern-tile{background-repeat:repeat}
  .mockup-row{display:flex;gap:24px;align-items:flex-start}
  .mockup-browser{border:1px solid ${tokens.color.muted};border-radius:${tokens.radius.base};overflow:hidden;width:220px}
  .mockup-tab{display:flex;align-items:center;gap:6px;background:${tokens.color.surface};padding:6px 10px;font-size:11px}
  .mockup-favicon{width:14px;height:14px}
  .mockup-favicon.placeholder{border:1px dashed ${tokens.color.muted};font-size:8px;display:flex;align-items:center;justify-content:center}
  .mockup-url-bar{height:20px;background:${tokens.color.bg};border-top:1px solid ${tokens.color.muted}}
  .mockup-card{width:260px;border:1px solid ${tokens.color.muted};border-radius:${tokens.radius.card};overflow:hidden}
  .mockup-og{width:100%;display:block}
  .mockup-og.placeholder{width:100%;height:120px;border:1px dashed ${tokens.color.muted};display:flex;align-items:center;justify-content:center;font-size:11px}
  .mockup-card-body{padding:8px 10px;font-size:12px}
  ul{padding-left:20px}
  `;
}

function buildBrandbookPage(brand, tokens, logoSvg, brandDir) {
  const sections = [
    logoSystemSection(brand, tokens, logoSvg),
    colorSection(tokens),
    typographySection(brand, tokens),
    graphicsSection(brand, tokens, brandDir),
    appliedAssetsSection(brand, brandDir),
    motionSection(brand, tokens),
  ].join('\n');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(brand.meta.project)} 브랜드북</title><style>${bookCss(tokens)}</style></head>
<body>
<h1>${escapeHtml(brand.meta.project)} 브랜드북</h1>
${sections}
</body></html>
`;
}

// ── CLI ──
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

function usage() {
  console.error('사용법: node brand-board.mjs <프로젝트> --board <svg1> <svg2> <svg3> [--label 라운드1] | --brandbook');
}

function parseArgs(argv) {
  const dir = argv[0];
  if (!dir || dir.startsWith('--')) { usage(); process.exit(1); }

  if (argv.includes('--brandbook')) return { dir, mode: 'brandbook' };

  const boardIdx = argv.indexOf('--board');
  if (boardIdx === -1) { usage(); process.exit(1); }
  const rest = argv.slice(boardIdx + 1);
  const labelIdx = rest.indexOf('--label');
  const svgs = labelIdx === -1 ? rest : rest.slice(0, labelIdx);
  const label = labelIdx === -1 ? null : rest[labelIdx + 1];
  if (svgs.length !== 3) {
    console.error(`--board는 시안 3개 필요 (받음: ${svgs.length}개)`);
    process.exit(1);
  }
  return { dir, mode: 'board', svgs, label };
}

function main() {
  const { dir, mode, svgs, label } = parseArgs(process.argv.slice(2));

  const brandPath = join(dir, '.design', 'brand.json');
  if (!existsSync(brandPath)) {
    console.error('.design/brand.json 필요 — /brand로 브리프부터 진행'); process.exit(1);
  }
  const brand = JSON.parse(readFileSync(brandPath, 'utf8'));
  const bv = validateBrand(brand);
  if (!bv.ok) { console.error('brand.json 검증 실패:\n- ' + bv.errors.join('\n- ')); process.exit(1); }

  const brandDir = join(dir, '.design', 'brand');
  mkdirSync(brandDir, { recursive: true });

  if (mode === 'board') {
    const svgContents = svgs.map(p => {
      const abs = isAbsolute(p) ? p : join(dir, p);
      if (!existsSync(abs)) { console.error(`시안 SVG 없음: ${p}`); process.exit(1); }
      return readFileSync(abs, 'utf8');
    });
    const outPath = join(brandDir, '_board.html');
    writeFileSync(outPath, buildBoardPage(brand, svgContents, label));
    console.log(JSON.stringify({ written: [outPath] }, null, 2));
    process.exit(0);
  }

  // --brandbook
  const tokensPath = join(dir, '.design', 'tokens.json');
  if (!existsSync(tokensPath)) {
    console.error('.design/tokens.json 필요 — /design-tokens로 기준부터 확보'); process.exit(1);
  }
  const tokens = JSON.parse(readFileSync(tokensPath, 'utf8'));

  const logoPath = join(dir, brand.logo.svg);
  if (!existsSync(logoPath)) { console.error(`로고 SVG 없음: ${brand.logo.svg}`); process.exit(1); }
  const logoSvg = readFileSync(logoPath, 'utf8');

  const outPath = join(brandDir, 'brandbook.html');
  writeFileSync(outPath, buildBrandbookPage(brand, tokens, logoSvg, brandDir));
  console.log(JSON.stringify({ written: [outPath] }, null, 2));
  process.exit(0);
}
