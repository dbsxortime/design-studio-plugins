#!/usr/bin/env node
/* 확정 OG 조판(og-template.html) → 동적 치환 → 캡처 페이지 생성.
   node og-render.mjs <프로젝트> --title "글 제목" [--slogan "..."] [--out og-post-slug]
     → .design/brand/_og-capture.html — {{TITLE}}/{{SLOGAN}} 치환한 1200×630 캡처 박스(id="cap-og")
     → stdout JSON: {capturePath, targetPng, size}. 캡처(PNG 저장)는 스킬이 playwright로 수행.
   og-template.html은 /brand 미팅 4에서 확정한 조판을 스킬이 저장한 파일(제목 길이별 폰트 스케일 등
   조판 로직은 템플릿 자체 CSS 책임 — 이 스크립트는 치환만 하고 조판에 관여하지 않는다).
   외부 요청 0, 산출 결정적(타임스탬프 금지). */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function buildOgCapturePage(renderedTemplate) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:#ffffff}
  #cap-og{overflow:hidden;position:relative;box-sizing:border-box}
</style></head>
<body>
<div id="cap-og" style="width:1200px;height:630px">
${renderedTemplate}
</div>
</body></html>
`;
}

// ── CLI ──
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

function usage() {
  console.error('사용법: node og-render.mjs <프로젝트> --title "글 제목" [--slogan "..."] [--out og-post-slug]');
}

function parseArgs(argv) {
  const dir = argv[0];
  if (!dir || dir.startsWith('--')) { usage(); process.exit(1); }

  const titleIdx = argv.indexOf('--title');
  const title = titleIdx === -1 ? undefined : argv[titleIdx + 1];
  if (!title || title.startsWith('--')) {
    console.error('--title 필요'); process.exit(1);
  }

  const sloganIdx = argv.indexOf('--slogan');
  const slogan = sloganIdx === -1 ? null : argv[sloganIdx + 1];

  const outIdx = argv.indexOf('--out');
  const out = outIdx === -1 ? 'og' : argv[outIdx + 1];

  return { dir, title, slogan, out };
}

function main() {
  const { dir, title, slogan, out } = parseArgs(process.argv.slice(2));

  const brandDir = join(dir, '.design', 'brand');
  const templatePath = join(brandDir, 'og-template.html');
  if (!existsSync(templatePath)) {
    console.error('og-template.html 없음 — 미팅 4를 먼저 진행하세요'); process.exit(1);
  }
  const template = readFileSync(templatePath, 'utf8');

  // --slogan 생략 시 brand.json applications.og.slogan → 그것도 없으면 빈 문자열
  let finalSlogan = slogan;
  if (finalSlogan === null) {
    finalSlogan = '';
    const brandPath = join(dir, '.design', 'brand.json');
    if (existsSync(brandPath)) {
      try {
        const brand = JSON.parse(readFileSync(brandPath, 'utf8'));
        finalSlogan = brand.applications?.og?.slogan ?? '';
      } catch { /* brand.json 파싱 실패 시 빈 문자열 유지 */ }
    }
  }

  const rendered = template
    .replaceAll('{{TITLE}}', escapeHtml(title))
    .replaceAll('{{SLOGAN}}', escapeHtml(finalSlogan));

  const capturePath = join(brandDir, '_og-capture.html');
  writeFileSync(capturePath, buildOgCapturePage(rendered));

  const targetPng = join(brandDir, 'social', `${out}.png`);
  console.log(JSON.stringify({ capturePath, targetPng, size: '1200x630' }, null, 2));
  process.exit(0);
}
