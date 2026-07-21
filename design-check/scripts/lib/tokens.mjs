const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function validateTokens(t) {
  const errors = [];
  const need = (cond, msg) => { if (!cond) errors.push(msg); };
  need(t && t.$schema === 'design-studio/tokens-v1', '$schema != design-studio/tokens-v1');
  need(t?.color && HEX.test(t.color.primary || ''), 'color.primary는 hex여야 함');
  for (const k of ['onPrimary', 'bg', 'surface', 'text', 'muted']) {
    const v = t?.color?.[k];
    need(!v || HEX.test(expandHex(v)), `color.${k} hex 형식 오류`);
  }
  need(typeof t?.font?.family === 'string' && t.font.family.length > 0, 'font.family 필요');
  need(pxOf(t?.radius?.base) > 0, 'radius.base px 필요');
  need(pxOf(t?.spacing?.unit) > 0, 'spacing.unit px 필요');
  return { ok: errors.length === 0, errors };
}

/* primary 위 텍스트색 자동 대비 — WCAG 대비율 기반 (버튼=큰 텍스트, 3:1 기준).
   흰색이 3:1 이상이면 흰색, 아니면 진회색. 스튜디오 목업의 규칙과 동일. */
export function contrastOn(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => {
    v /= 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92; });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (1.05) / (L + 0.05) >= 3 ? '#FFFFFF' : '#111111';
}

export function expandHex(hex) {
  if (!HEX.test(hex || '')) return hex || '';
  return hex.length === 4
    ? '#' + [...hex.slice(1)].map(c => c + c).join('') : hex;
}

function hexToRgb(hex) {
  const h = expandHex(hex).slice(1);
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

export function hexToLab(hex) {
  let [r, g, b] = hexToRgb(hex).map(v => {
    v /= 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92; });
  const [x, y, z] = [
    (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047,
    (r * 0.2126 + g * 0.7152 + b * 0.0722),
    (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883,
  ].map(v => v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

export function deltaE(h1, h2) {   // CIE76
  const a = hexToLab(h1), b = hexToLab(h2);
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
}

export function pxOf(v) {
  if (v == null) return 0;
  const s = String(v).trim();
  if (s.endsWith('rem')) return parseFloat(s) * 16;
  return parseFloat(s) || 0;
}

export function allowedColors(t) {
  return [t.color.primary, t.color.onPrimary, t.color.bg, t.color.surface,
    t.color.text, t.color.muted,
    ...(t.color.allowed || [])].filter(Boolean).map(expandHex);
}

/* tokens-v1 → DaisyUI 테마. 신뢰 가능한 필드만 매핑, 나머지는 DaisyUI 기본 상속. 결정적. */
export function daisyTheme(tokens) {
  const c = tokens.color || {}, r = tokens.radius || {};
  const pairs = [
    ['--color-primary', expandHex(c.primary)],
    ['--color-base-100', expandHex(c.bg)],
    ['--color-base-200', expandHex(c.surface)],
    ['--color-base-content', expandHex(c.text)],
    ['--color-neutral', expandHex(c.muted)],
    ['--radius-selector', r.base],
    ['--radius-field', r.base],
    ['--radius-box', r.card || r.base],
  ].filter(([, v]) => v);
  const body = pairs.map(([k, v]) => `  ${k}: ${v};`).join('\n');
  const name = (tokens.meta && tokens.meta.project) || 'custom';
  return `@plugin "daisyui/theme" {\n  name: "${name}";\n  default: true;\n  color-scheme: light;\n${body}\n}\n`;
}
