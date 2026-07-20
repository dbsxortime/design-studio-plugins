/* 브랜드 조건부 코어 — 순수 함수. 매체·제공자 무관. */

const ASPECTS = {
  og:     { w: 1200, h: 630 },
  hero:   { w: 1920, h: 1080 },
  square: { w: 1080, h: 1080 },
  story:  { w: 1080, h: 1920 },
};

export function aspectFor(use) {
  return ASPECTS[use] || ASPECTS.hero;
}

/* 항상 막을 것 + 브랜드가 금지한 것(brand.forbid) */
export function negativeFrom(brand = {}) {
  const always = ['text', 'watermark', 'logo', 'signature', 'caption', 'lowres', 'jpeg artifacts'];
  const forbid = Array.isArray(brand.forbid) ? brand.forbid : [];
  return [...always, ...forbid].join(', ');
}

/* 배경·텍스처는 강하게 브랜드 톤으로, 실사(portrait/photo)는 약하게 */
export function paletteLockFor(use, intent = '') {
  const photo = /photo|portrait|realistic|person|product shot/i.test(intent);
  if (use === 'hero' && photo) return 'light';
  return 'strong';
}

export function buildScaffold({ tokens, brand = {}, intent = '', use = 'hero' }) {
  const palette = (tokens?.color?.allowed || [tokens?.color?.primary]).filter(Boolean);
  const paletteStr = palette.join(', ');
  const positive = [
    intent.trim(),
    brand.styleKeywords ? String(brand.styleKeywords) : '',
    `color palette strictly limited to ${paletteStr}`,
    'clean composition, professional, high detail',
  ].filter(Boolean).join(', ');
  return {
    positive,
    negative: negativeFrom(brand),
    aspect: aspectFor(use),
    paletteLock: paletteLockFor(use, intent),
    palette,
  };
}
