#!/usr/bin/env node
/* CLI: --in <img.png> --out <locked.png> --palette "#hex,#hex" --strength strong|light|off
   playwright로 이미지를 캔버스에 그려 팔레트 최근접색과 mix, PNG로 저장.
   playwright 미설치/브라우저 미가용 시 안내 후 원본 복사(락 skip). */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { gradeStrength, recolorScript } from './lib/palette-lock.mjs';

const args = process.argv.slice(2);
const get = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const inPath = get('in'), outPath = get('out');
const palette = (get('palette', '') || '').split(',').map(s => s.trim()).filter(Boolean);
const strength = gradeStrength(get('strength', 'strong'));

if (strength === 0 || palette.length === 0) { copyFileSync(inPath, outPath); process.exit(0); }

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { console.error('playwright 없음 — 락 skip, 원본 복사'); copyFileSync(inPath, outPath); process.exit(0); }

const b64 = readFileSync(inPath).toString('base64');
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`<img src="data:image/png;base64,${b64}">`);
  await page.waitForSelector('img');
  const dataUrl = await page.evaluate(`(${recolorScript()})(${JSON.stringify(palette)}, ${strength})`);
  writeFileSync(outPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(JSON.stringify({ out: outPath, strength, palette }));
} catch (err) {
  console.error('브라우저 실행 실패 — 락 skip, 원본 복사');
  copyFileSync(inPath, outPath);
  process.exit(0);
} finally { if (browser) await browser.close(); }
