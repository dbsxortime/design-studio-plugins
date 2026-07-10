import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseMotions } from '../design-studio/scripts/lib/motions-parse.mjs';

const html = readFileSync('design-studio/assets/studio.html', 'utf8');

test('parseMotions: 카드 수·필드 무결성', () => {
  const m = parseMotions(html);
  assert.ok(m.length >= 140, `expected >=140, got ${m.length}`);
  const split = m.find(x => x.id === 'split-text');
  assert.equal(split.cat, 'text');
  assert.ok(split.code.includes('SplitText'));
  assert.ok(Array.isArray(split.links) && split.links[0].length === 2);
  for (const x of m) { assert.ok(x.id && x.cat && x.title && x.code, `broken: ${x.id}`); }
});

test('CLI: list/search/get/add-use', () => {
  const env = { ...process.env, CLAUDE_PLUGIN_DATA: '/tmp/ds-cli-test-' + Date.now() };
  const run = a => execFileSync('node', ['design-studio/scripts/motion-lab.mjs', ...a],
    { encoding: 'utf8', env });
  assert.ok(JSON.parse(run(['list', '--json'])).length >= 140);
  assert.ok(run(['search', 'marquee']).includes('marquee'));
  const got = JSON.parse(run(['get', 'shimmer-button', '--json']));
  assert.ok(got.code.includes('shimmer'));
  run(['add-use', 'shimmer-button', '--p', '테스트', '--where', 'x.tsx', '--how', 'CTA', '--date', '2026-07']);
  const got2 = JSON.parse(run(['get', 'shimmer-button', '--json']));
  assert.ok(got2.uses.some(u => u.p === '테스트'));
});
