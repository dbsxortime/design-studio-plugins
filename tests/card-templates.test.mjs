import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';

const DIR = 'brand-studio/references/card-templates';
const FRAGS = [1, 2, 3, 4, 5, 6, 7].map(n => `${DIR}/frag-${n}.html`);
const PERSONAL = ['박윤택', 'jobstaek@gmail.com', '010-8998-0372', 'jobslab.dev',
  'AI Builder', 'JOBSLAB', 'jobslab', 'Minimum Input', 'Maximum Output'];
const SLOT_RE = /\{\{([a-zA-Z]+)\}\}/g;
const ALLOWED = new Set(['name','role','org','orgUpper','domain','phone','email',
  'slogan1','slogan2','copy','initial','monogram','qr']);

test('shell: 존재 + 토큰 마커', () => {
  const s = readFileSync(`${DIR}/_shell-head.html`, 'utf8');
  assert.ok(s.includes('/*CARD-TOKENS-START*/') && s.includes('/*CARD-TOKENS-END*/'));
});

test('frags: 69종, data-id 유일, 개인정보 0, 슬롯은 허용 목록만', () => {
  let total = 0; const ids = new Set();
  for (const f of FRAGS) {
    assert.ok(existsSync(f), f);
    const html = readFileSync(f, 'utf8');
    const tpls = html.match(/class="tpl"/g) || [];
    total += tpls.length;
    for (const [, id] of html.matchAll(/data-id="([^"]+)"/g)) {
      assert.ok(!ids.has(id), `dup ${id}`); ids.add(id);
    }
    for (const p of PERSONAL) assert.ok(!html.includes(p), `${f}: "${p}" 잔존`);
    for (const [, s] of html.matchAll(SLOT_RE)) assert.ok(ALLOWED.has(s), `${f}: 미허용 슬롯 {{${s}}}`);
  }
  assert.strictEqual(total, 69);
  assert.strictEqual(ids.size, 69);
});
