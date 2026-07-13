import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const DIR = 'brand-studio/references/card-templates';
const CATS = ['minimal', 'bold', 'classic', 'creative', 'pattern', 'tech', 'texture'];
const FORMATS = new Set(['landscape', 'square', 'vertical', 'mini', 'credit']);

test('manifest: 69항목, id↔frag 대응, 필드 유효', () => {
  const m = JSON.parse(readFileSync(`${DIR}/manifest.json`, 'utf8'));
  assert.strictEqual(m.length, 69);
  const fragIds = new Set();
  for (let n = 1; n <= 7; n++) {
    const html = readFileSync(`${DIR}/frag-${n}.html`, 'utf8');
    for (const [, id] of html.matchAll(/data-id="([^"]+)"/g)) fragIds.add(id);
  }
  const seen = new Set();
  for (const e of m) {
    assert.ok(fragIds.has(e.id), `id ${e.id} not in frags`);
    assert.ok(!seen.has(e.id)); seen.add(e.id);
    assert.ok(CATS.includes(e.category), e.id);
    assert.ok(['S', 'A', 'B'].includes(e.grade), e.id);
    assert.ok(['pass', 'polish'].includes(e.verdict), e.id);
    assert.ok(FORMATS.has(e.format), e.id);
    assert.ok(Array.isArray(e.tags) && e.tags.length >= 3, `${e.id} tags>=3`);
    assert.ok(Array.isArray(e.needs) && Array.isArray(e.finish));
    if (e.verdict === 'polish') assert.ok(e.notes && e.notes.length > 0, `${e.id} notes`);
  }
  // QR 슬롯 카드가 needs:qr을 선언하는지 교차 검증
  for (let n = 1; n <= 7; n++) {
    const html = readFileSync(`${DIR}/frag-${n}.html`, 'utf8');
    for (const block of html.split('class="tpl" ').slice(1)) {
      const id = block.match(/data-id="([^"]+)"/)[1];
      if (block.split('class="tpl"')[0].includes('{{qr}}')) {
        const entry = m.find(x => x.id === id);
        assert.ok(entry.needs.includes('qr'), `${id} needs qr`);
      }
    }
  }
});
