#!/usr/bin/env node
/* CLI: <project> --prompt <..> --model <..> --seed <..> --asset <path> --cost <usd>
   출처 1건 append 후 record JSON 출력. */
import { recordGeneration } from './lib/provenance.mjs';
const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith('--')) || '.';
const get = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const rec = recordGeneration(dir, {
  prompt: get('prompt', ''), negative: get('negative', ''),
  model: get('model', ''), seed: get('seed', ''),
  asset: get('asset', ''), cost: get('cost', ''),
  aspect: get('aspect', ''),
});
console.log(JSON.stringify(rec, null, 2));
