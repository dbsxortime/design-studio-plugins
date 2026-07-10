import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

test('check-report: 위반 검출·통과 구분', () => {
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
  execFileSync('node', ['design-check/scripts/check-report.mjs', 'tests/fixture'],
    { encoding: 'utf8' });
  const rep = JSON.parse(readFileSync('tests/fixture/.design/check-report.json', 'utf8'));
  // #ff0000, #e74c3c → high (비허용 색)
  assert.ok(rep.violations.some(v => v.severity === 'high' && v.actual === '#ff0000'));
  // radius 3px (base 10±2 밖, card/pill 아님) → med
  assert.ok(rep.violations.some(v => v.severity === 'med' && v.actual === '3px'));
  // Comic Sans → low(폰트 이탈)
  assert.ok(rep.violations.some(v => v.severity === 'low' && /comic/i.test(v.actual)));
  // #0046FF·rgb(0,70,255)는 primary와 일치 → 위반 아님
  assert.ok(!rep.violations.some(v => v.actual.includes('0046ff')));
  assert.ok(!rep.violations.some(v => v.actual.includes('rgb(0, 70, 255)')));
  // rgba(0,0,0,0.1) 반투명(그림자)은 팔레트 판정 보류 → 위반 아님
  assert.ok(!rep.violations.some(v => v.actual.includes('0, 0, 0, 0.1')));
  // rgba(0, 70, 255, 1) 알파=1은 완전 불투명 → primary와 일치 → 위반 아님
  assert.ok(!rep.violations.some(v => v.actual.includes('0, 70, 255, 1')));
  assert.ok(rep.summary.high >= 2 && rep.summary.med >= 2);
});
