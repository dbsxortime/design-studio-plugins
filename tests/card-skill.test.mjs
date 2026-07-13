import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

test('card SKILL: frontmatter + 필수 절차 포함', () => {
  const s = readFileSync('brand-studio/skills/card/SKILL.md', 'utf8');
  assert.ok(s.startsWith('---'));
  assert.ok(/name:\s*card/.test(s));
  for (const kw of ['tokens.json', '--gallery', '--variants', '--print', '28573',
    'card.json', 'CMYK', '체크리스트', '규격은', 'qr'])
    assert.ok(s.includes(kw), `SKILL에 "${kw}" 누락`);
});

test('plugin.json: 1.3.0 + /card 표기', () => {
  const p = JSON.parse(readFileSync('brand-studio/.claude-plugin/plugin.json', 'utf8'));
  assert.match(p.version, /^\d+\.\d+\.\d+$/);
  assert.ok(p.version !== '1.2.0');
  assert.ok(p.description.includes('/card'));
});
