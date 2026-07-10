import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

test('apply-map: 위반 → 치환 계획', () => {
  // report.test.mjs 실행 순서에 의존하지 않도록 픽스처를 직접 생성(자기충족)
  mkdirSync('tests/fixture/.design', { recursive: true });
  writeFileSync('tests/fixture/.design/tokens.json', JSON.stringify({
    $schema: 'design-studio/tokens-v1',
    meta: { project: 'fixture', updated: '2026-07-10', source: 'onboarding' },
    color: { primary: '#0046FF', bg: '#ffffff', surface: '#f4f5f7',
      text: '#111111', muted: '#777777', allowed: [] },
    font: { family: 'Pretendard', headingWeight: 800, bodySize: '14px' },
    radius: { base: '10px', card: '14px', pill: '999px' },
    spacing: { unit: '4px', gutter: '16px' },
    tolerance: { colorDeltaE: 5, radiusPx: 2 } }));
  execFileSync('node', ['design-check/scripts/check-report.mjs', 'tests/fixture']);
  const out = JSON.parse(execFileSync('node',
    ['design-check/scripts/apply-map.mjs', 'tests/fixture'], { encoding: 'utf8' }));
  const all = out.plan.flatMap(p => p.edits);
  // #ff0000 → primary로 치환 제안
  assert.ok(all.some(e => e.from === '#ff0000' && e.to === '#0046FF'));
  // radius 3px → base 10px
  assert.ok(all.some(e => e.from === '3px' && e.to === '10px'));
  // 파일별 그룹화
  assert.ok(out.plan.every(p => p.file && p.edits.length > 0));
});
