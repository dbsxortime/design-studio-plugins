#!/usr/bin/env node
/* 쇼케이스 번들 빌드 — 브랜드 산출물(컨셉·브랜드북·명함 갤러리·인쇄 PDF)을
   "웹에 그대로 올리는 자기완결 정적 폴더"로 묶는다.
   node showcase-build.mjs <프로젝트> [--base-url https://host/slug] [--cta <url>] [--note "<html>"]
     → <프로젝트>/.design/showcase/ (index.html은 컨셉 페이지로 즉시 이동)
   원칙: 원본 산출물 무수정(사본에만 알림 바 주입), 결정적 생성, 존재하는 산출물만 탭에 노출. */
import { readFileSync, writeFileSync, mkdirSync, cpSync, copyFileSync, existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

const [projectArg, ...rest] = process.argv.slice(2);
if (!projectArg) { console.error('사용법: showcase-build.mjs <프로젝트> [--base-url URL] [--cta URL] [--note html]'); process.exit(1); }
const ROOT = resolve(projectArg);
const arg = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : null; };

const tokens = JSON.parse(readFileSync(join(ROOT, '.design/tokens.json'), 'utf8'));
const brand = existsSync(join(ROOT, '.design/brand.json')) ? JSON.parse(readFileSync(join(ROOT, '.design/brand.json'), 'utf8')) : null;
const card = existsSync(join(ROOT, '.design/card.json')) ? JSON.parse(readFileSync(join(ROOT, '.design/card.json'), 'utf8')) : null;
const project = tokens.meta?.project || 'brand';
const c = tokens.color;

const OUT = join(ROOT, '.design/showcase');
mkdirSync(OUT, { recursive: true });

/* ── 1) 산출물 수집 (있는 것만) ── */
const artifacts = []; // { file, label, src }
const takeHtml = (src, file, label) => { if (existsSync(src)) { copyFileSync(src, join(OUT, file)); artifacts.push({ file, label }); } };
takeHtml(join(ROOT, '.design/brand/concept.html'), 'concept.html', '컨셉 페이지');
takeHtml(join(ROOT, '.design/brand/brandbook.html'), 'brandbook.html', '브랜드북');
takeHtml(join(ROOT, '.design/card/gallery.html'), 'card-gallery.html', '명함 갤러리');
if (!artifacts.length) { console.error('산출물 없음 — /brand 미팅 6(brandbook/concept)을 먼저 완료하라'); process.exit(1); }

let pdfFile = null;
const pdfSrc = (card?.exports || []).find(p => p.endsWith('.pdf'));
if (pdfSrc && existsSync(pdfSrc)) { pdfFile = basename(pdfSrc); copyFileSync(pdfSrc, join(OUT, pdfFile)); }

for (const [src, dest] of [
  [join(ROOT, '.design/brand/details.css'), 'details.css'],
  [join(ROOT, '.design/brand/og.png'), 'og.png'],
]) if (existsSync(src)) copyFileSync(src, join(OUT, dest));
if (existsSync(join(ROOT, '.design/brand/icons'))) cpSync(join(ROOT, '.design/brand/icons'), join(OUT, 'icons'), { recursive: true });

/* ── 2) 알림 바 (토큰 파생 색 — 다크 바 위 흰 계열, 활성 탭 = primary) ── */
const accent = `color-mix(in srgb, ${c.primary} 40%, #ffffff)`;
const philosophy = brand?.brief?.philosophy ? ` · "${brand.brief.philosophy}"` : '';
const note = arg('--note') ||
  `지금 보는 페이지는 <b>Design Studio</b>(/brand·/card)가 생성한 <b>실제 산출물</b>입니다 — ${project}${philosophy}`;
const cta = arg('--cta') || 'https://github.com/dbsxortime/design-studio-plugins';

const bar = (active) => `
<!-- design-studio showcase bar -->
<style>
#nsb{position:fixed;left:0;right:0;top:0;z-index:99999;background:color-mix(in srgb, ${c.text} 94%, transparent);
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#FFFFFF;
  font-family:'${tokens.font.family}',-apple-system,sans-serif;font-size:14px;line-height:1.5;
  display:flex;align-items:center;gap:20px;padding:16px 22px;flex-wrap:wrap}
#nsb .nsb-tabs{display:flex;gap:4px;flex-wrap:wrap}
#nsb .nsb-tabs a{color:rgba(255,255,255,.72);text-decoration:none;padding:7px 14px;border-radius:999px;white-space:nowrap}
#nsb .nsb-tabs a:hover{background:rgba(255,255,255,.08)}
#nsb .nsb-tabs a.on{background:${c.primary};color:${c.onPrimary}}
#nsb .nsb-note{margin-left:auto;display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:0;margin-bottom:0}
#nsb .nsb-note span{color:rgba(255,255,255,.62)}
#nsb .nsb-note b{color:#FFFFFF;font-weight:600}
#nsb .nsb-cta{color:${accent};text-decoration:none;font-weight:600;white-space:nowrap}
#nsb .nsb-cta:hover{text-decoration:underline}
body{padding-top:76px !important}
@media (max-width:720px){#nsb{font-size:12.5px;gap:10px;padding:12px 14px}#nsb .nsb-note{margin-left:0}body{padding-top:120px !important}}
</style>
<div id="nsb">
  <nav class="nsb-tabs">
${artifacts.map(a => `    <a href="${a.file}"${a.file === active ? ' class="on"' : ''}>${a.label}</a>`).join('\n')}
${pdfFile ? `    <a href="${pdfFile}">인쇄 PDF ↓</a>` : ''}
  </nav>
  <p class="nsb-note">
    <span>${note}</span>
    <a class="nsb-cta" href="${cta}">나도 만들기 →</a>
  </p>
</div>
`;

/* ── 3) OG 메타 (base-url 있을 때만 절대 og:image) ── */
const baseUrl = (arg('--base-url') || '').replace(/\/$/, '');
const slogan = brand?.applications?.og?.slogan || brand?.brief?.philosophy || '';
const OG = `<meta property="og:title" content="${project}${slogan ? ' — ' + slogan : ''} · Design Studio 산출물">
<meta property="og:description" content="로고·브랜드북·명함까지 — Design Studio가 만든 실제 산출물을 그대로 공개합니다.">
${baseUrl && existsSync(join(OUT, 'og.png')) ? `<meta property="og:image" content="${baseUrl}/og.png">\n<meta name="twitter:card" content="summary_large_image">` : ''}
${existsSync(join(OUT, 'icons/favicon.svg')) ? '<link rel="icon" type="image/svg+xml" href="icons/favicon.svg">' : ''}`;

/* ── 4) 주입 + index ── */
for (const a of artifacts) {
  const p = join(OUT, a.file);
  let html = readFileSync(p, 'utf8');
  if (a.file === artifacts[0].file) html = html.replace('</head>', OG + '\n</head>');
  html = html.replace('</body>', bar(a.file) + '\n</body>');
  writeFileSync(p, html);
}
writeFileSync(join(OUT, 'index.html'), `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<title>${project} — Design Studio 산출물</title>
${OG}
<meta http-equiv="refresh" content="0; url=${artifacts[0].file}">
${baseUrl ? `<link rel="canonical" href="${baseUrl}/${artifacts[0].file}">` : ''}
</head><body><a href="${artifacts[0].file}">${project} 산출물로 이동</a></body></html>
`);

console.log(JSON.stringify({
  out: OUT,
  artifacts: artifacts.map(a => a.file),
  pdf: pdfFile,
  ogImage: Boolean(baseUrl && existsSync(join(OUT, 'og.png'))),
  note: baseUrl ? undefined : 'base-url 미지정 — og:image(절대 URL) 생략됨, 배포 URL 확정 후 --base-url로 재실행 권장',
}, null, 2));
