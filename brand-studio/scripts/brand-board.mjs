#!/usr/bin/env node
/* 시안 보드 + 브랜드북 + 컨셉 페이지 조립.
   3 CLI 모드:
   node brand-board.mjs <프로젝트> --board <svg1> <svg2> <svg3> [--label 라운드1]
     → .design/brand/_board.html — 시안 3안을 라이트/다크/32px 3맥락으로 나란히 렌더
   node brand-board.mjs <프로젝트> --brandbook
     → .design/brand/brandbook.html — 6축 조립(로고 시스템·색·타이포·그래픽 언어·적용 자산·모션/디테일)
   node brand-board.mjs <프로젝트> --concept
     → .design/brand/concept.html — 확정 토큰·자산을 실제 서비스 랜딩처럼 조립한 쇼케이스 한 장
   외부 요청 0, 산출 결정적(타임스탬프 금지) — 스타일은 인라인 CSS 단일 HTML. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { validateBrand, deriveDetailsCss, toMono } from './lib/brand.mjs';
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

// ── --concept (쇼케이스 랜딩 한 장) ──
// 슬로건 우선순위: brief.philosophy → applications.og.slogan → brief.oneLiner
function conceptSlogan(brand) {
  return brand.brief?.philosophy || brand.applications?.og?.slogan || brand.brief?.oneLiner || '';
}

// 키워드 카드 아이콘: graphics.shapes[i] 실존 시 그 셰이프, 없으면 로고 심볼로 대체
function keywordIcon(brand, brandDir, logoSvg, i) {
  const name = (brand.graphics?.shapes ?? [])[i];
  if (name) {
    const abs = join(brandDir, 'graphics', name);
    if (existsSync(abs)) return `<img class="kw-icon" src="${dataUri(readFileSync(abs, 'utf8'))}" alt=""/>`;
  }
  return `<img class="kw-icon" src="${dataUri(logoSvg)}" alt=""/>`;
}

// 푸터 심볼: symbol+mono 변형 파일(logo/logo-<variant>.svg) 실존 시 사용, 아니면 로고 원본
function footerSymbol(brand, brandDir, logoSvg) {
  const v = (brand.logo?.variants ?? []).find(x => /symbol/i.test(x) && /mono/i.test(x)) || 'symbol-mono';
  const abs = join(brandDir, 'logo', `logo-${v}.svg`);
  const svg = existsSync(abs) ? readFileSync(abs, 'utf8') : logoSvg;
  return `<img class="footer-symbol" src="${dataUri(svg)}" alt=""/>`;
}

// 결정적 문자열 해시(랜덤·타임스탬프 금지) — 목업 수치를 콘텐츠의 순수 함수로 파생
function strHash(s) {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h;
}

// 로고 white 변형: symbol+white(또는 white) 변형 파일 실존 시 사용, 없으면 밝은 배경색(bg)으로 단색화 파생
function whiteLogo(brand, brandDir, logoSvg, tokens) {
  const vars = brand.logo?.variants ?? [];
  const v = vars.find(x => /symbol/i.test(x) && /white/i.test(x)) || vars.find(x => /white/i.test(x));
  if (v) {
    const abs = join(brandDir, 'logo', `logo-${v}.svg`);
    if (existsSync(abs)) return readFileSync(abs, 'utf8');
  }
  // 어두운 밴드 대비 확보 — 색은 토큰(bg)에서만
  return toMono(logoSvg, tokens.color.bg);
}

function conceptCss(tokens) {
  const c = tokens.color, f = tokens.font, r = tokens.radius;
  const onPrimary = c.onPrimary || contrastOn(c.primary);
  const heading = f.headingWeight ?? 700;
  // 대비 크래프트: 히어로 텍스트는 onPrimary/primary(≥4.5:1), 패턴은 onPrimary 틴트 저투명 + 스크림으로 본문 침범 방지
  return `
  *,*::before,*::after{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{background:${c.bg};color:${c.text};font-family:'${f.family}',system-ui,sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased}
  img{max-width:100%;display:block}
  a{text-decoration:none}
  .wrap{max-width:1120px;margin:0 auto;padding-left:24px;padding-right:24px}
  .eyebrow{text-transform:uppercase;letter-spacing:.14em;font-size:.72rem;font-weight:700;opacity:.7}
  .btn{display:inline-flex;align-items:center;justify-content:center;padding:14px 26px;border-radius:${r.base};font-weight:600;font-size:1rem;border:1px solid transparent;cursor:pointer}
  .section{padding-top:96px;padding-bottom:96px}
  .section-head{text-align:center;max-width:42ch;margin:0 auto 52px}
  .section-head h2{margin:10px 0 0;font-size:clamp(1.7rem,3.3vw,2.4rem);font-weight:${heading};letter-spacing:-.02em}
  .section-head p{margin:14px 0 0;color:${c.muted}}
  .reveal{transition:opacity .6s ease, transform .6s ease}
  html.has-io .reveal{opacity:0;transform:translateY(16px)}
  html.has-io .reveal.is-in{opacity:1;transform:none}

  /* 1) 히어로 — 풀블리드 primary + 우측 제품 목업 */
  .hero{position:relative;overflow:hidden;background:${c.primary};color:${onPrimary}}
  .hero-pattern{position:absolute;inset:0;background-repeat:repeat;opacity:.12;pointer-events:none}
  .hero-scrim{position:absolute;inset:0;background:linear-gradient(155deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.20) 100%);pointer-events:none}
  .hero .wrap{position:relative;padding-top:92px;padding-bottom:92px}
  .hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center}
  .hero-title{margin:18px 0 0;font-size:clamp(2.6rem,5.4vw,4.2rem);line-height:1.04;font-weight:${heading};letter-spacing:-.03em}
  .hero-slogan{margin:20px 0 0;font-size:clamp(1.1rem,2.2vw,1.4rem);max-width:32ch;opacity:.92}
  .hero-cta{display:flex;gap:14px;flex-wrap:wrap;margin-top:34px}
  .hero .btn-primary{background:${onPrimary};color:${c.primary}}
  .hero .btn-secondary{background:transparent;color:${onPrimary};border-color:${onPrimary}}

  /* 브라우저 크롬 목업 */
  .mockup{background:${c.bg};border-radius:${r.card};overflow:hidden;box-shadow:0 34px 64px -22px rgba(0,0,0,.5),0 0 0 1px rgba(0,0,0,.04)}
  .mockup-chrome{display:flex;align-items:center;gap:10px;padding:11px 14px;background:${c.surface}}
  .mockup-dots{display:flex;gap:6px}
  .mockup-dots i{width:10px;height:10px;border-radius:50%;background:${c.muted};opacity:.5}
  .mockup-tab{display:flex;align-items:center;gap:7px;margin-left:8px;background:${c.bg};border-radius:${r.pill};padding:4px 12px 4px 8px;font-size:.75rem;color:${c.text}}
  .mockup-tab img{width:14px;height:14px}
  .app{padding:18px 18px 20px}
  .app-topbar{display:flex;align-items:center;gap:10px;padding-bottom:14px;border-bottom:1px solid ${c.surface}}
  .app-topbar img{width:22px;height:22px}
  .app-brand{font-weight:${heading};font-size:.95rem}
  .app-avatar{margin-left:auto;width:26px;height:26px;border-radius:50%;background:${c.primary}}
  .app-summary{margin-top:16px;background:${c.surface};border-radius:${r.card};padding:18px 20px}
  .app-metric{display:flex;align-items:baseline;gap:10px}
  .app-metric b{font-size:2.2rem;font-weight:${heading};color:${c.primary};line-height:1}
  .app-delta{font-size:.78rem;font-weight:700;color:${c.primary};background:${c.bg};border-radius:${r.pill};padding:3px 9px}
  .app-metric-label{margin-top:6px;font-size:.8rem;color:${c.muted}}
  .app-list{margin-top:14px}
  .app-row{display:flex;align-items:center;gap:12px;padding:10px 4px;border-bottom:1px solid ${c.surface}}
  .app-row .dot{width:30px;height:30px;border-radius:${r.base};background:${c.surface};flex:none;display:flex;align-items:center;justify-content:center}
  .app-row .dot span{width:12px;height:12px;border-radius:50%;background:${c.primary};opacity:.75}
  .app-row .rt{font-weight:600;font-size:.85rem}
  .app-row .rs{font-size:.72rem;color:${c.muted}}
  .app-row .rv{margin-left:auto;font-weight:700;font-size:.85rem;color:${c.text}}
  .app-cta{margin-top:16px}
  .app-cta .btn{width:100%;background:${c.primary};color:${onPrimary};padding:12px}

  /* 3) 키워드 카드 */
  .kw-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
  .keyword-card{background:${c.surface};border-radius:${r.card};padding:34px 30px;display:flex;flex-direction:column;gap:16px;transition:transform .2s ease, box-shadow .2s ease}
  .keyword-card:hover{transform:translateY(-6px);box-shadow:0 18px 40px -18px rgba(0,0,0,.28)}
  .kw-icon{width:46px;height:46px;object-fit:contain}
  .keyword-card h3{margin:0;font-size:1.3rem;font-weight:${heading};text-transform:capitalize}
  .keyword-card p{margin:0;color:${c.muted};font-size:.95rem;line-height:1.5}

  /* 4) 컴포넌트 쇼케이스 */
  .components{background:${c.surface}}
  .comp-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}
  .comp-card{background:${c.bg};border-radius:${r.card};padding:24px;display:flex;flex-direction:column;gap:16px}
  .comp-card h4{margin:0;font-size:.74rem;text-transform:uppercase;letter-spacing:.08em;color:${c.muted}}
  .comp-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  .comp-row .lbl{font-size:.9rem;font-weight:600}
  .btn-sm{padding:10px 18px;font-size:.9rem;border-radius:${r.base};font-weight:600;border:1px solid transparent}
  .b-primary{background:${c.primary};color:${onPrimary}}
  .b-secondary{background:${c.surface};color:${c.text};border-color:${c.muted}}
  .b-disabled{background:${c.surface};color:${c.muted};opacity:.55}
  .field{display:flex;flex-direction:column;gap:6px;width:100%}
  .field label{font-size:.78rem;color:${c.muted}}
  .field input{border:1px solid ${c.muted};border-radius:${r.base};padding:11px 13px;font:inherit;color:${c.text};background:${c.bg}}
  .field input:focus{outline:2px solid ${c.primary};outline-offset:1px}
  .toggle{width:46px;height:26px;border-radius:${r.pill};background:${c.primary};position:relative;flex:none}
  .toggle::after{content:"";position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;background:${onPrimary}}
  .banner{display:flex;gap:12px;align-items:flex-start;background:${c.surface};border-left:3px solid ${c.primary};border-radius:${r.base};padding:14px 16px}
  .banner .bi{width:20px;height:20px;border-radius:50%;background:${c.primary};flex:none;margin-top:1px}
  .banner .bt{font-size:.85rem}
  .mini-card{border:1px solid ${c.surface};border-radius:${r.card};padding:16px;display:flex;gap:12px;align-items:center}
  .mini-card .mc-ic{width:34px;height:34px;border-radius:${r.base};background:${c.primary};flex:none}
  .mini-card .mc-t{font-weight:600;font-size:.9rem}
  .mini-card .mc-s{font-size:.75rem;color:${c.muted}}

  /* 5) 다크 밴드 — 로고 반전 + 스토리 + 로딩 목업 */
  .darkband{background:${c.text};color:${c.bg}}
  .dark-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}
  .darkband-logo{width:64px;height:64px;object-fit:contain}
  .dark-story{margin:22px 0 0;font-size:clamp(1.15rem,2.4vw,1.55rem);line-height:1.6;max-width:34ch}
  .dark-card{background:${c.surface};color:${c.text};border-radius:${r.card};padding:24px}
  .dc-head{display:flex;align-items:center;gap:10px;font-size:.85rem;color:${c.muted}}
  .dc-bars{display:flex;flex-direction:column;gap:10px;margin:16px 0 4px}
  .dc-bar{height:12px;border-radius:${r.base};background:${c.muted};opacity:.22}
  .dc-bar.l1{width:90%}.dc-bar.l2{width:68%}
  .live-row{display:flex;gap:28px;flex-wrap:wrap;align-items:center;margin-top:18px}
  .live-item{display:flex;flex-direction:column;align-items:center;gap:10px;font-size:.72rem;color:${c.muted}}
  .live-skel{width:120px;height:14px}

  /* 6) 푸터 */
  .footer{text-align:center;padding:56px 24px;display:flex;flex-direction:column;align-items:center;gap:12px}
  .footer-symbol{width:40px;height:40px;object-fit:contain}
  .footer-name{font-weight:${heading};font-size:1.1rem}
  .footer-slogan{color:${c.muted};font-size:.9rem}

  @media (max-width:860px){
    .hero-grid,.dark-grid{grid-template-columns:1fr;gap:40px}
    .kw-grid,.comp-grid{grid-template-columns:1fr}
    .hero .wrap{padding-top:64px;padding-bottom:64px}
    .section{padding-top:64px;padding-bottom:64px}
  }
  @media (prefers-reduced-motion: reduce){
    html.has-io .reveal{opacity:1;transform:none;transition:none}
    .keyword-card,.btn,.btn-sm{transition:none}
  }
  `;
}

function buildConceptPage(brand, tokens, logoSvg, brandDir) {
  const c = tokens.color;
  const onPrimary = c.onPrimary || contrastOn(c.primary);
  const slogan = conceptSlogan(brand);
  const anim = brand.motion?.logoAnim;
  const logoClass = anim && anim !== 'none' ? ` logo-${anim}` : '';
  const keywords = brand.brief.keywords;
  const kw0 = keywords[0];

  // 결정적 파생 수치 — 콘텐츠 문자열의 순수 함수(랜덤·타임스탬프 없음)
  const h = strHash(brand.meta.project + '|' + keywords.join(','));
  const score = `${h % 30 + 70}.${h % 10}`;
  const delta = `+${h % 8 + 2}%`;

  // ── 1) 히어로 (primary 풀블리드) + 우측 제품 목업 ──
  const patternName = (brand.graphics?.patterns ?? [])[0];
  let heroPattern = '';
  if (patternName) {
    const abs = join(brandDir, 'graphics', patternName);
    // primary 배경 위에서 보이도록 패턴을 onPrimary 틴트로 단색화
    if (existsSync(abs)) heroPattern = `<div class="hero-pattern" style="background-image:url('${dataUri(toMono(readFileSync(abs, 'utf8'), onPrimary))}')"></div>`;
  }
  const appRows = keywords.map(kw =>
    `<div class="app-row"><div class="dot"><span></span></div>` +
    `<div><div class="rt">${escapeHtml(kw)}</div><div class="rs">'${escapeHtml(kw)}' 톤을 반영한 항목</div></div>` +
    `<div class="rv">${strHash(kw) % 40 + 10}</div></div>`
  ).join('');
  const mockup = `<div class="mockup reveal">
      <div class="mockup-chrome"><div class="mockup-dots"><i></i><i></i><i></i></div>
        <div class="mockup-tab"><img src="${dataUri(logoSvg)}" alt=""/>${escapeHtml(brand.meta.project)}</div></div>
      <div class="app">
        <div class="app-topbar"><img src="${dataUri(logoSvg)}" alt=""/><span class="app-brand">${escapeHtml(brand.meta.project)}</span><span class="app-avatar"></span></div>
        <div class="app-summary"><div class="app-metric"><b>${score}</b><span class="app-delta">${delta}</span></div>
          <div class="app-metric-label">${escapeHtml(kw0)} 지수 · 이번 주</div></div>
        <div class="app-list">${appRows}</div>
        <div class="app-cta"><span class="btn ds-press">자세히 보기</span></div>
      </div>
    </div>`;
  const hero = `<header class="hero">
  ${heroPattern}<div class="hero-scrim"></div>
  <div class="wrap"><div class="hero-grid">
    <div class="hero-copy">
      <div class="eyebrow">${escapeHtml(keywords.join(' · '))}</div>
      <h1 class="hero-title">${escapeHtml(brand.meta.project)}</h1>
      ${slogan ? `<p class="hero-slogan">${escapeHtml(slogan)}</p>` : ''}
      <div class="hero-cta">
        <a class="btn btn-primary ds-press" href="#">시작하기</a>
        <a class="btn btn-secondary" href="#">더 알아보기</a>
      </div>
    </div>
    ${mockup}
  </div></div>
</header>`;

  // ── 3) 키워드 카드 3개(설명 한 줄 결정적 템플릿, hover lift + 스크롤 리빌) ──
  const kwCards = keywords.map((kw, i) =>
    `<article class="keyword-card reveal">${keywordIcon(brand, brandDir, logoSvg, i)}` +
    `<h3>${escapeHtml(kw)}</h3><p>모든 화면에서 '${escapeHtml(kw)}'의 인상을 유지합니다.</p></article>`
  ).join('');
  const keywordsSection = `<section class="section"><div class="wrap">
    <div class="section-head"><div class="eyebrow">Keywords</div><h2>브랜드를 이루는 세 가지</h2>
    <p>확정한 핵심 키워드가 제품 곳곳에 일관되게 흐릅니다.</p></div>
    <div class="kw-grid">${kwCards}</div></div></section>`;

  // ── 4) 컴포넌트 쇼케이스 밴드(전부 토큰 조립) ──
  const components = `<section class="section components"><div class="wrap">
    <div class="section-head"><div class="eyebrow">Components</div><h2>이 브랜드의 UI 조각들</h2>
    <p>디자인 토큰으로 조립한 실제 컴포넌트 — 브랜딩이 곧 디자인 시스템으로 이어집니다.</p></div>
    <div class="comp-grid">
      <div class="comp-card reveal"><h4>버튼</h4><div class="comp-row"><span class="btn-sm b-primary">기본</span><span class="btn-sm b-secondary">보조</span><span class="btn-sm b-disabled">비활성</span></div></div>
      <div class="comp-card reveal"><h4>입력 필드</h4><div class="field"><label>이메일</label><input placeholder="이름을 입력하세요" readonly/></div></div>
      <div class="comp-card reveal"><h4>토글</h4><div class="comp-row"><span class="toggle"></span><span class="lbl">알림 켜짐</span></div></div>
      <div class="comp-card reveal"><h4>알림 배너</h4><div class="banner"><span class="bi"></span><div class="bt">변경 사항이 저장되었습니다.</div></div></div>
      <div class="comp-card reveal"><h4>카드</h4><div class="mini-card"><span class="mc-ic"></span><div><div class="mc-t">${escapeHtml(kw0)} 리포트</div><div class="mc-s">방금 업데이트됨</div></div></div></div>
    </div></div></section>`;

  // ── 5) 다크 밴드 — 로고 white 변형(배경 대응) + 스토리 + 로딩 목업(디테일 라이브) ──
  const hasDetails = existsSync(join(brandDir, 'details.css'));
  const activeIds = new Set(
    [...deriveDetailsCss(tokens, brand).matchAll(/\/\* detail:([\w-]+) \*\//g)].map(m => m[1])
  );
  const livePieces = [];
  if (hasDetails && activeIds.has('spinner')) livePieces.push('<div class="live-item"><div class="ds-spinner"></div><span>로딩 스피너</span></div>');
  if (hasDetails && activeIds.has('skeleton')) livePieces.push('<div class="live-item"><div class="ds-skeleton live-skel"></div><span>스켈레톤</span></div>');
  const story = brand.brief?.story || slogan;
  const darkband = `<section class="section darkband"><div class="wrap"><div class="dark-grid">
    <div>
      <img class="darkband-logo${logoClass}" src="${dataUri(whiteLogo(brand, brandDir, logoSvg, tokens))}" alt="${escapeHtml(brand.meta.project)} 로고(반전)"/>
      ${story ? `<p class="dark-story">${escapeHtml(story)}</p>` : ''}
    </div>
    <div class="dark-card reveal">
      <div class="dc-head"><span>${escapeHtml(kw0)} 불러오는 중</span></div>
      <div class="dc-bars"><span class="dc-bar l1"></span><span class="dc-bar l2"></span></div>
      ${livePieces.length ? `<div class="live-row">${livePieces.join('')}</div>` : ''}
    </div>
  </div></div></section>`;

  // ── 6) 푸터 — 심볼 mono + 프로젝트명 + 슬로건 ──
  const footer = `<footer class="footer">${footerSymbol(brand, brandDir, logoSvg)}` +
    `<div class="footer-name">${escapeHtml(brand.meta.project)}</div>` +
    `${slogan ? `<div class="footer-slogan">${escapeHtml(slogan)}</div>` : ''}</footer>`;

  const detailsLink = hasDetails ? '<link rel="stylesheet" href="details.css">' : '';
  // 스크롤 리빌: JS 있으면 has-io로 숨김→관찰 진입 시 표시(리듀스드모션은 CSS가 즉시 표시), JS 없으면 항상 표시. 정적 문자열이라 결정적
  const revealScript = "<script>(function(){if(!('IntersectionObserver' in window))return;var r=document.documentElement;r.classList.add('has-io');" +
    "var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('is-in');io.unobserve(e.target);}});},{rootMargin:'0px 0px -8% 0px'});" +
    "document.querySelectorAll('.reveal').forEach(function(el){io.observe(el);});" +
    "addEventListener('load',function(){setTimeout(function(){document.querySelectorAll('.reveal').forEach(function(el){el.classList.add('is-in');});},1400);});})();<\/script>";
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(brand.meta.project)} — 컨셉</title>${detailsLink}<style>${conceptCss(tokens)}</style></head>
<body>
${hero}
${keywordsSection}
${components}
${darkband}
${footer}
${revealScript}
</body></html>
`;
}

// ── CLI ──
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

function usage() {
  console.error('사용법: node brand-board.mjs <프로젝트> --board <svg1> <svg2> <svg3> [--label 라운드1] | --brandbook | --concept');
}

function parseArgs(argv) {
  const dir = argv[0];
  if (!dir || dir.startsWith('--')) { usage(); process.exit(1); }

  if (argv.includes('--brandbook')) return { dir, mode: 'brandbook' };
  if (argv.includes('--concept')) return { dir, mode: 'concept' };

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

  // --brandbook | --concept : 둘 다 tokens + 로고 SVG 필요
  const tokensPath = join(dir, '.design', 'tokens.json');
  if (!existsSync(tokensPath)) {
    console.error('.design/tokens.json 필요 — /design-tokens로 기준부터 확보'); process.exit(1);
  }
  const tokens = JSON.parse(readFileSync(tokensPath, 'utf8'));

  const logoPath = join(dir, brand.logo.svg);
  if (!existsSync(logoPath)) { console.error(`로고 SVG 없음: ${brand.logo.svg}`); process.exit(1); }
  const logoSvg = readFileSync(logoPath, 'utf8');

  if (mode === 'concept') {
    const outPath = join(brandDir, 'concept.html');
    writeFileSync(outPath, buildConceptPage(brand, tokens, logoSvg, brandDir));
    console.log(JSON.stringify({ written: [outPath] }, null, 2));
    process.exit(0);
  }

  const outPath = join(brandDir, 'brandbook.html');
  writeFileSync(outPath, buildBrandbookPage(brand, tokens, logoSvg, brandDir));
  console.log(JSON.stringify({ written: [outPath] }, null, 2));
  process.exit(0);
}
