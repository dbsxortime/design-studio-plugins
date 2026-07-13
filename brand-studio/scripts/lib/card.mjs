import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// shell CARD-TOKENS 마커 안의 12키(기본 6 + primary/text 파생 5 + gold)만 교체 대상.
// --c-a-green/--c-a-red는 시맨틱 리터럴이라 shell의 마커 블록 밖에 남겨두고 여기선 다루지 않는다.
export function deriveCardTokens(tokens) {
  const c = tokens.color;
  return {
    '--c-primary': c.primary, '--c-on': c.onPrimary, '--c-bg': c.bg,
    '--c-surface': c.surface, '--c-text': c.text, '--c-muted': c.muted,
    '--c-a-lav': `color-mix(in srgb, ${c.primary} 45%, #ffffff)`,
    '--c-a-lav2': `color-mix(in srgb, ${c.primary} 62%, #ffffff)`,
    '--c-a-light': `color-mix(in srgb, ${c.primary} 10%, #ffffff)`,
    '--c-a-deep': `color-mix(in srgb, ${c.primary} 78%, #000000)`,
    '--c-a-ink2': `color-mix(in srgb, ${c.text} 88%, #000000)`,
    '--c-a-gold': '#8A6A2F',
  };
}

export function fillSlots(html, info) {
  const d = {
    name: info.name ?? '', role: info.role ?? '', org: info.org ?? '',
    orgUpper: (info.org ?? '').toUpperCase(),
    domain: info.domain ?? '', phone: info.phone ?? '', email: info.email ?? '',
    slogan1: info.slogan1 ?? '', slogan2: info.slogan2 ?? '', copy: info.copy ?? '',
    initial: (info.name ?? '').slice(0, 1),
    monogram: info.monogram ?? (info.org ?? 'XX').slice(0, 2).toUpperCase(),
    qr: info.qrInner ?? '<!--qr-pending-->',
  };
  let out = html;
  for (const [k, v] of Object.entries(d)) out = out.replaceAll(`{{${k}}}`, v);
  return out;
}

export function loadCardState(dir) {
  const p = join(dir, '.design/card.json');
  if (!existsSync(p)) return { $schema: 'brand-studio/card-v1', info: null, picks: [], rounds: [], final: null, exports: [] };
  return JSON.parse(readFileSync(p, 'utf8'));
}

export function saveCardState(dir, state) {
  mkdirSync(join(dir, '.design'), { recursive: true });
  writeFileSync(join(dir, '.design/card.json'), JSON.stringify(state, null, 2) + '\n');
}
