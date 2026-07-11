import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

test('brand-studio plugin.json — 버전·의존성 3종', () => {
  const p = JSON.parse(readFileSync('brand-studio/.claude-plugin/plugin.json', 'utf8'));
  assert.strictEqual(p.name, 'brand-studio');
  assert.strictEqual(p.version, '1.0.0');
  const names = p.dependencies.map(d => typeof d === 'string' ? d : d.name);
  assert.deepStrictEqual(names.sort(), ['design-check', 'design-studio', 'playwright']);
  const pw = p.dependencies.find(d => typeof d === 'object');
  assert.strictEqual(pw.marketplace, 'claude-plugins-official');
});

test('marketplace.json에 brand-studio 등록', () => {
  const m = JSON.parse(readFileSync('.claude-plugin/marketplace.json', 'utf8'));
  assert.ok(m.plugins.some(p => p.name === 'brand-studio' && p.source === './brand-studio'));
});

test('README — 설치 명령·의존성 그래프·브랜드 단계', () => {
  const md = readFileSync('README.md', 'utf8');
  assert.ok(md.includes('claude plugin install brand-studio@design-studio-plugins'));
  assert.ok(md.includes('/brand'));
  assert.ok(/brand-studio.*──.*design-check/s.test(md) || md.includes('brand-studio → design-check'));
  assert.ok(md.includes('Node 18'));
});
