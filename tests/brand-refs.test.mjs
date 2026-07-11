import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { deriveDetailsCss } from '../brand-studio/scripts/lib/brand.mjs';

const REF = 'brand-studio/references';
const read = (f) => readFileSync(`${REF}/${f}`, 'utf8');

test('플레이북 5권이 references/에 존재', () => {
  for (const f of ['logo-playbook.md', 'graphics-playbook.md', 'asset-playbook.md', 'detail-pack.md', 'fonts.md']) {
    assert.ok(existsSync(`${REF}/${f}`), `${f} 없음`);
  }
});

test('logo-playbook — 6타입·질문 트리·드로잉 크래프트·시안/회전 규칙', () => {
  const md = read('logo-playbook.md');
  for (const t of ['wordmark', 'lettermark', 'symbol', 'emblem', 'mascot', 'abstract']) {
    assert.ok(md.includes(t), `로고 타입 ${t} 누락`);
  }
  assert.ok(md.includes('질문 트리'), '질문 트리 섹션 누락');
  assert.ok(/##\s*드로잉 크래프트/.test(md), '드로잉 크래프트 H2 누락');
  for (const kw of ['동심 코너', '키라인', '광학 보정', '오버슈트', '네거티브 스페이스', '픽셀 정합']) {
    assert.ok(md.includes(kw), `드로잉 크래프트 문구 ${kw} 누락`);
  }
  assert.ok(md.includes('안전안') && md.includes('도전안'), '3안 방향 규칙 누락');
  assert.ok(md.includes('2회전'), '수정 회전 상한 누락');
});

test('graphics-playbook — 크래프트 일관성·심리스·저대비·경로 규약', () => {
  const md = read('graphics-playbook.md');
  assert.ok(/##\s*크래프트 일관성/.test(md), '크래프트 일관성 H2 누락');
  assert.ok(md.includes('심리스'), '심리스 타일 규칙 누락');
  assert.ok(md.includes('저대비'), '배경용 저대비 규칙 누락');
  assert.ok(md.includes('셰이프 세트'), '셰이프 세트 규칙 누락');
  assert.ok(md.includes('.design/brand/graphics/'), '패턴 경로 규약 누락');
  assert.ok(md.includes('404'), '상태 화면 규칙 누락');
});

test('asset-playbook — 조판 크래프트·대비 4.5·스크림·제목 스케일·소셜/이메일', () => {
  const md = read('asset-playbook.md');
  assert.ok(/##\s*조판 크래프트/.test(md), '조판 크래프트 H2 누락');
  assert.ok(md.includes('4.5:1'), '대비 4.5:1 문구 누락');
  assert.ok(md.includes('스크림'), '스크림 규칙 누락');
  for (const px of ['88px', '64px', '48px']) {
    assert.ok(md.includes(px), `제목 길이 스케일 ${px} 누락`);
  }
  assert.ok(md.includes('maskable') && md.includes('80%'), 'maskable 안전영역 누락');
  for (const spec of ['1500×500', '2048×1152', '1128×191']) {
    assert.ok(md.includes(spec), `소셜 규격 ${spec} 누락`);
  }
  assert.ok(md.includes('600px'), '이메일 표준 폭 누락');
  assert.ok(md.includes('{{TITLE}}') && md.includes('{{SLOGAN}}'), 'OG 플레이스홀더 누락');
});

test('detail-pack — 9항목·프리셋 4종·접근성 모션 크래프트', () => {
  const md = read('detail-pack.md');
  for (const id of ['selection', 'focus-ring', 'scrollbar', 'spinner', 'skeleton', 'fade-in', 'press']) {
    assert.ok(md.includes(`detail:${id}`), `항목 마커 detail:${id} 누락`);
  }
  for (const p of ['draw', 'fade', 'spin', 'pulse']) {
    assert.ok(new RegExp(`\\b${p}\\b`).test(md), `로고 모션 프리셋 ${p} 누락`);
  }
  assert.ok(/##\s*접근성·모션 크래프트/.test(md), '접근성·모션 크래프트 H2 누락');
  assert.ok(md.includes('3:1'), '포커스 링 대비 3:1 누락');
  assert.ok(/초당 3회/.test(md) && md.includes('점멸'), '점멸 금지 규칙 누락');
  assert.ok(md.includes('0.8~1.5s'), '로딩 루프 지속시간 규칙 누락');
});

test('detail-pack — CSS 정본이 deriveDetailsCss 출력과 1:1 일치', () => {
  const md = read('detail-pack.md');
  // 토큰값에 의존하지 않는 리터럴 조각만 대조 (값은 tokens에서 치환되므로)
  const literals = [
    '.ds-spinner', 'border: 3px solid', 'animation: ds-spin .8s linear infinite',
    '@keyframes ds-spin', '::selection', ':focus-visible', 'outline-offset: 2px',
    '::-webkit-scrollbar', '.ds-skeleton', 'animation: ds-skeleton 1.5s ease infinite',
    '.ds-fade-in', '.ds-press', 'transform: scale(0.97)',
    '@media (prefers-reduced-motion: reduce)',
  ];
  for (const s of literals) {
    assert.ok(md.includes(s), `CSS 정본 조각 누락: ${s}`);
  }
  // deriveDetailsCss가 실제로 그 리터럴을 뱉는지 역검증 (계약 드리프트 방지)
  const tokens = {
    color: { primary: '#111', onPrimary: '#fff', bg: '#fafafa', surface: '#eee', muted: '#999' },
    spacing: { unit: '8px' }, radius: { pill: '999px', base: '8px' },
  };
  const css = deriveDetailsCss(tokens, {});
  for (const s of literals) {
    assert.ok(css.includes(s), `deriveDetailsCss 출력에 없는 조각을 문서가 인용: ${s}`);
  }
});

test('fonts — 라이선스 열·금지 규칙·무료 폰트만(상용 폰트 부재)', () => {
  const md = read('fonts.md');
  assert.ok(md.includes('이 목록 외 폰트 제안 금지'), '금지 규칙 헤더 누락');
  assert.ok(md.includes('라이선스'), '라이선스 열 누락');
  assert.ok(md.includes('Pretendard') && md.includes('SIL OFL'), '무료 폰트/라이선스 표기 누락');
  for (const banned of ['Regola', 'Society', 'Helvetica', 'Proxima', 'Circular', 'Gotham']) {
    assert.ok(!md.includes(banned), `상용 폰트명 등장 금지 위반: ${banned}`);
  }
});
