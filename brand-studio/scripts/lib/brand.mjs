// brand-v1 스키마 검증 + 파생 규칙 (스펙 §6)
const LOGO_TYPES = ['wordmark', 'lettermark', 'symbol', 'emblem', 'mascot', 'abstract'];
export const PHASES = ['brief', 'logo', 'system', 'graphics', 'applications', 'details', 'final', 'exported'];

export function validateBrand(b) {
  const errors = [];
  const need = (cond, msg) => { if (!cond) errors.push(msg); };
  need(b && b.$schema === 'brand-studio/brand-v1', '$schema != brand-studio/brand-v1');
  need(typeof b?.meta?.project === 'string' && b.meta.project.length > 0, 'meta.project 필요');
  need(Array.isArray(b?.brief?.keywords) && b.brief.keywords.length === 3, 'brief.keywords는 3개 필요');
  need(LOGO_TYPES.includes(b?.decisions?.logoType), `decisions.logoType은 ${LOGO_TYPES.join('|')} 중 하나`);
  need(PHASES.includes(b?.progress?.phase), `progress.phase는 ${PHASES.join('|')} 중 하나`);
  return { ok: errors.length === 0, errors };
}

export function nextPhase(cur) {
  const i = PHASES.indexOf(cur);
  if (i === -1 || i === PHASES.length - 1) return null;
  return PHASES[i + 1];
}

/* fill/stroke 색 값 전부를 단색화. none·transparent는 유지, url() 참조는 제거하고 단색 대입 */
export function toMono(svgText, color) {
  const KEEP = new Set(['none', 'transparent']);
  const monoVal = (val) => KEEP.has(val.trim().toLowerCase()) ? val : color;
  return svgText
    .replace(/(fill|stroke)(\s*=\s*)"([^"]*)"/gi, (m, attr, eq, val) => `${attr}${eq}"${monoVal(val)}"`)
    .replace(/style="([^"]*)"/gi, (m, style) =>
      `style="${style.replace(/(fill|stroke)(\s*:\s*)([^;"]+)/gi, (mm, prop, eq, val) => `${prop}${eq}${monoVal(val)}`)}"`);
}

/* 배경 사각(bg) 위 중앙 80% 안전영역에 원본을 축소 배치한 새 SVG (maskable icon) */
export function maskableWrap(svgText, size = 512, bg = '#ffffff') {
  const margin = size * 0.1;
  const inner = size * 0.8;
  const vbMatch = svgText.match(/viewBox="([^"]*)"/i);
  const viewBox = vbMatch ? vbMatch[1] : `0 0 ${size} ${size}`;
  const openMatch = svgText.match(/<svg\b[^>]*>/i);
  const innerContent = svgText.slice(openMatch.index + openMatch[0].length, svgText.lastIndexOf('</svg>'));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" fill="${bg}"/>` +
    `<svg x="${margin}" y="${margin}" width="${inner}" height="${inner}" viewBox="${viewBox}">${innerContent}</svg>` +
    `</svg>`;
}

/* detail-pack 항목별 활성 여부 — assets.details에 명시 없으면 기본 활성 */
function isDetailEnabled(brand, id) {
  const found = brand?.assets?.details?.find(d => d.id === id);
  return found ? found.enabled !== false : true;
}

/* detail-pack CSS 7종(선택색·포커스링·스크롤바·스피너·스켈레톤·페이드인·눌림감) + reduced-motion 폴백.
   각 항목 CSS는 detail-pack.md(T6) 정본과 1:1 동일해야 함 — 값은 tokens에서만, 하드코딩 색 금지 */
export function deriveDetailsCss(tokens, brand) {
  const t = tokens;
  const blocks = [];
  const motionSelectors = [];

  if (isDetailEnabled(brand, 'selection')) {
    blocks.push(`/* detail:selection */\n::selection { background: ${t.color.primary}; color: ${t.color.onPrimary}; }`);
  }
  if (isDetailEnabled(brand, 'focus-ring')) {
    blocks.push(`/* detail:focus-ring */\n:focus-visible { outline: 2px solid ${t.color.primary}; outline-offset: 2px; }`);
  }
  if (isDetailEnabled(brand, 'scrollbar')) {
    blocks.push(`/* detail:scrollbar */\n::-webkit-scrollbar { width: ${t.spacing.unit}; }\n` +
      `::-webkit-scrollbar-track { background: ${t.color.bg}; }\n` +
      `::-webkit-scrollbar-thumb { background: ${t.color.muted}; border-radius: ${t.radius.pill}; }`);
  }
  if (isDetailEnabled(brand, 'spinner')) {
    blocks.push(`/* detail:spinner */\n.ds-spinner { width: 24px; height: 24px; border: 3px solid ${t.color.surface}; ` +
      `border-top-color: ${t.color.primary}; border-radius: 50%; animation: ds-spin .8s linear infinite; }\n` +
      `@keyframes ds-spin { to { transform: rotate(360deg); } }`);
    motionSelectors.push('.ds-spinner');
  }
  if (isDetailEnabled(brand, 'skeleton')) {
    blocks.push(`/* detail:skeleton */\n.ds-skeleton { background: linear-gradient(90deg, ${t.color.surface} 25%, ` +
      `${t.color.bg} 50%, ${t.color.surface} 75%); background-size: 200% 100%; ` +
      `animation: ds-skeleton 1.5s ease infinite; border-radius: ${t.radius.base}; }\n` +
      `@keyframes ds-skeleton { to { background-position: -200% 0; } }`);
    motionSelectors.push('.ds-skeleton');
  }
  if (isDetailEnabled(brand, 'fade-in')) {
    blocks.push(`/* detail:fade-in */\n.ds-fade-in { animation: ds-fade-in .3s ease both; }\n` +
      `@keyframes ds-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`);
    motionSelectors.push('.ds-fade-in');
  }
  const pressEnabled = isDetailEnabled(brand, 'press');
  if (pressEnabled) {
    blocks.push(`/* detail:press */\n.ds-press { transition: transform .1s ease; }\n.ds-press:active { transform: scale(0.97); }`);
  }

  if (motionSelectors.length || pressEnabled) {
    const lines = [];
    if (motionSelectors.length) lines.push(`  ${motionSelectors.join(', ')} { animation: none; }`);
    if (pressEnabled) lines.push(`  .ds-press { transition: none; }`);
    blocks.push(`@media (prefers-reduced-motion: reduce) {\n${lines.join('\n')}\n}`);
  }
  return blocks.join('\n\n') + '\n';
}

/* webmanifest — theme_color/background_color는 tokens에서, 아이콘 192/512/maskable */
export function deriveManifest(brand, tokens) {
  return {
    name: brand.meta.project,
    theme_color: tokens.color.primary,
    background_color: tokens.color.bg,
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

/* PNG 헤더(IHDR 16~24바이트)에서 치수 파싱 */
export function pngSize(buffer) {
  return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) };
}
