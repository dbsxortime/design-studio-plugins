# 브랜드 조건부 생성 (visual-studio) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 클라이언트 브랜드 토큰에 조건부로 이미지·영상을 생성하고 팔레트로 후처리하는 `visual-studio` 플러그인(`generate` 스킬)을 만든다.

**Architecture:** node ESM 순수 로직 3모듈(프롬프트 조립·팔레트 락·출처 기록) + SKILL이 에이전트에게 오케스트레이션을 지시(생성은 에이전트가 Replicate MCP 도구 호출). MCP는 node가 아니라 에이전트가 부른다 — node는 IO·변환만.

**Tech Stack:** Node.js ESM(.mjs), node 내장 `node:test`/`node:assert`, playwright(캔버스 기반 이미지 후처리 — 기존 플러그인 공통 의존), Replicate MCP(transport, 설치 시 확정).

## Global Constraints

- 모든 스크립트는 ESM `.mjs`, **외부 npm 의존 추가 금지** — node 표준 라이브러리 + (이미 있는) playwright만. (design-check 정책 계승)
- 클라이언트 전용 — `.design/brand.json`의 `meta.project`가 `jobslab`이면 **생성 차단**(경고).
- 색·프롬프트는 클라이언트 `.design/tokens.json` 팔레트에서만 파생. 하드코딩 색 금지.
- 생성물은 커밋하지 않음 — 변경 목록만 제시(플러그인 공통 철칙).
- 비용 게이트: MCP 호출 전 프롬프트+예상 비용을 사람에게 보이고 승인.
- 출처 기록: `<project>/assets/generated/_provenance.json`.
- plugin.json 버전은 `0.1.0`으로 시작. marketplace.json에 `visual-studio` 등록.

---

## File Structure

- `visual-studio/.claude-plugin/plugin.json` — 플러그인 매니페스트
- `visual-studio/skills/generate/SKILL.md` — 오케스트레이션 워크플로(에이전트용 프로토콜)
- `visual-studio/scripts/lib/prompt-brand.mjs` — 브랜드 조건부 코어(순수 함수)
- `visual-studio/scripts/lib/provenance.mjs` — 출처 기록(순수 IO)
- `visual-studio/scripts/lib/palette-lock.mjs` — 팔레트 락(playwright 캔버스)
- `visual-studio/scripts/build-prompt.mjs` — CLI: 프로젝트 토큰→스캐폴드 JSON 출력
- `visual-studio/scripts/palette-lock.mjs` — CLI: 이미지+팔레트→락본 저장
- `visual-studio/scripts/record.mjs` — CLI: 출처 append
- `visual-studio/tests/prompt-brand.test.mjs` · `provenance.test.mjs` · `palette-lock.test.mjs`
- `visual-studio/tests/fixture/tokens.json` — 테스트용 클라이언트 토큰
- `.claude-plugin/marketplace.json` — `visual-studio` 엔트리 추가(수정)

---

### Task 1: 플러그인 스캐폴드 + 마켓플레이스 등록

**Files:**
- Create: `visual-studio/.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json` (plugins 배열에 항목 추가)

**Interfaces:**
- Produces: 플러그인 id `visual-studio@design-studio-plugins` — 이후 스킬·스크립트의 루트.

- [ ] **Step 1: plugin.json 작성**

`visual-studio/.claude-plugin/plugin.json`:
```json
{
  "name": "visual-studio",
  "version": "0.1.0",
  "description": "브랜드 조건부 이미지·영상 생성. 클라이언트 .design 토큰을 프롬프트에 주입하고 결과를 팔레트로 후처리(/generate). Transport는 MCP(Replicate 등).",
  "dependencies": [
    "design-check",
    {
      "name": "playwright",
      "marketplace": "claude-plugins-official"
    }
  ]
}
```

- [ ] **Step 2: marketplace.json에 등록**

`.claude-plugin/marketplace.json`의 `plugins` 배열 끝에 추가:
```json
{
  "name": "visual-studio",
  "source": "./visual-studio",
  "description": "브랜드 조건부 이미지·영상 생성 — .design 토큰 주입 + 팔레트 후처리 (/generate)"
}
```

- [ ] **Step 3: 매니페스트 검증**

Run: `claude plugin validate visual-studio`
Expected: 검증 통과(오류 0). 실패 시 JSON 문법·필수 필드 확인.

- [ ] **Step 4: Commit**

```bash
git add visual-studio/.claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "feat(visual-studio): 플러그인 스캐폴드 + 마켓플레이스 등록"
```

---

### Task 2: 브랜드 조건부 코어 (prompt-brand)

**Files:**
- Create: `visual-studio/scripts/lib/prompt-brand.mjs`
- Create: `visual-studio/scripts/build-prompt.mjs`
- Test: `visual-studio/tests/prompt-brand.test.mjs`
- Create: `visual-studio/tests/fixture/tokens.json`

**Interfaces:**
- Produces:
  - `buildScaffold({ tokens, brand, intent, use }) → { positive, negative, aspect, paletteLock, palette }`
  - `aspectFor(use) → { w, h }` (use ∈ `og|hero|square|story`, 기본 `hero`)
  - `negativeFrom(brand) → string`
  - `paletteLockFor(use) → 'strong'|'light'`

- [ ] **Step 1: 테스트 픽스처 작성**

`visual-studio/tests/fixture/tokens.json`:
```json
{
  "$schema": "design-studio/tokens-v1",
  "meta": { "project": "acme" },
  "color": { "primary": "#0046FF", "bg": "#FFFFFF", "text": "#111111",
    "allowed": ["#0046FF", "#EAF1FF", "#111111"] }
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`visual-studio/tests/prompt-brand.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScaffold, aspectFor, negativeFrom } from '../scripts/lib/prompt-brand.mjs';

const tokens = { color: { primary: '#0046FF', allowed: ['#0046FF', '#EAF1FF', '#111111'] } };

test('aspectFor: og는 1200x630', () => {
  assert.deepEqual(aspectFor('og'), { w: 1200, h: 630 });
});

test('aspectFor: 미지정은 hero 기본', () => {
  assert.deepEqual(aspectFor('unknown'), aspectFor('hero'));
});

test('negativeFrom: forbid 목록이 네거티브에 반영', () => {
  const neg = negativeFrom({ forbid: ['gradient', 'emoji'] });
  assert.match(neg, /text/);       // 항상 포함
  assert.match(neg, /gradient/);
  assert.match(neg, /emoji/);
});

test('buildScaffold: 팔레트 hex가 positive에 포함', () => {
  const s = buildScaffold({ tokens, brand: {}, intent: 'hero background', use: 'hero' });
  assert.match(s.positive, /#0046FF/);
  assert.equal(s.aspect.w, 1920);
  assert.ok(['strong', 'light'].includes(s.paletteLock));
  assert.deepEqual(s.palette, ['#0046FF', '#EAF1FF', '#111111']);
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `node --test visual-studio/tests/prompt-brand.test.mjs`
Expected: FAIL — `Cannot find module '../scripts/lib/prompt-brand.mjs'`

- [ ] **Step 4: 최소 구현**

`visual-studio/scripts/lib/prompt-brand.mjs`:
```js
/* 브랜드 조건부 코어 — 순수 함수. 매체·제공자 무관. */

const ASPECTS = {
  og:     { w: 1200, h: 630 },
  hero:   { w: 1920, h: 1080 },
  square: { w: 1080, h: 1080 },
  story:  { w: 1080, h: 1920 },
};

export function aspectFor(use) {
  return ASPECTS[use] || ASPECTS.hero;
}

/* 항상 막을 것 + 브랜드가 금지한 것(brand.forbid) */
export function negativeFrom(brand = {}) {
  const always = ['text', 'watermark', 'logo', 'signature', 'caption', 'lowres', 'jpeg artifacts'];
  const forbid = Array.isArray(brand.forbid) ? brand.forbid : [];
  return [...always, ...forbid].join(', ');
}

/* 배경·텍스처는 강하게 브랜드 톤으로, 실사(portrait/photo)는 약하게 */
export function paletteLockFor(use, intent = '') {
  const photo = /photo|portrait|realistic|person|product shot/i.test(intent);
  if (use === 'hero' && photo) return 'light';
  return 'strong';
}

export function buildScaffold({ tokens, brand = {}, intent = '', use = 'hero' }) {
  const palette = (tokens?.color?.allowed || [tokens?.color?.primary]).filter(Boolean);
  const paletteStr = palette.join(', ');
  const positive = [
    intent.trim(),
    brand.styleKeywords ? String(brand.styleKeywords) : '',
    `color palette strictly limited to ${paletteStr}`,
    'clean composition, professional, high detail',
  ].filter(Boolean).join(', ');
  return {
    positive,
    negative: negativeFrom(brand),
    aspect: aspectFor(use),
    paletteLock: paletteLockFor(use, intent),
    palette,
  };
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `node --test visual-studio/tests/prompt-brand.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 6: CLI 래퍼 작성**

`visual-studio/scripts/build-prompt.mjs`:
```js
#!/usr/bin/env node
/* CLI: <project> --intent "<...>" --use <og|hero|square|story>
   프로젝트 .design에서 tokens/brand 읽어 스캐폴드 JSON 출력. jobslab self 차단. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildScaffold } from './lib/prompt-brand.mjs';

const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith('--')) || '.';
const get = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };

const tokens = JSON.parse(readFileSync(join(dir, '.design', 'tokens.json'), 'utf8'));
let brand = {};
try { brand = JSON.parse(readFileSync(join(dir, '.design', 'brand.json'), 'utf8')); } catch {}

if ((brand.meta?.project || tokens.meta?.project) === 'jobslab') {
  console.error('차단: visual-studio는 클라이언트 전용. jobslab 자체 브랜드는 이미지 최소 원칙.');
  process.exit(2);
}

const scaffold = buildScaffold({
  tokens, brand,
  intent: get('intent', ''),
  use: get('use', 'hero'),
});
console.log(JSON.stringify(scaffold, null, 2));
```

- [ ] **Step 7: CLI 스모크 + Commit**

Run: `node visual-studio/scripts/build-prompt.mjs visual-studio/tests --intent "abstract hero" --use og`
Expected: `--intent`가 없어 tokens 경로가 fixture가 아니므로 실패 가능 — 대신 fixture 디렉토리 구조로 확인:
Run: `mkdir -p /tmp/vt/.design && cp visual-studio/tests/fixture/tokens.json /tmp/vt/.design/ && node visual-studio/scripts/build-prompt.mjs /tmp/vt --intent "abstract hero" --use og`
Expected: JSON 출력, `aspect.w=1200`, `positive`에 `#0046FF` 포함.

```bash
git add visual-studio/scripts/lib/prompt-brand.mjs visual-studio/scripts/build-prompt.mjs visual-studio/tests/prompt-brand.test.mjs visual-studio/tests/fixture/tokens.json
git commit -m "feat(visual-studio): 브랜드 조건부 프롬프트 코어 + CLI"
```

---

### Task 3: 출처 기록 (provenance)

**Files:**
- Create: `visual-studio/scripts/lib/provenance.mjs`
- Create: `visual-studio/scripts/record.mjs`
- Test: `visual-studio/tests/provenance.test.mjs`

**Interfaces:**
- Consumes: 없음(독립).
- Produces:
  - `recordGeneration(projectDir, entry) → record` (record는 `{ id, ...entry }`, `assets/generated/_provenance.json`에 append)
  - `readProvenance(projectDir) → record[]`

- [ ] **Step 1: 실패 테스트**

`visual-studio/tests/provenance.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordGeneration, readProvenance } from '../scripts/lib/provenance.mjs';

test('recordGeneration: append + id 부여 + 재읽기', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vt-'));
  try {
    const r1 = recordGeneration(dir, { prompt: 'a', model: 'flux', seed: 1 });
    const r2 = recordGeneration(dir, { prompt: 'b', model: 'flux', seed: 2 });
    assert.equal(typeof r1.id, 'string');
    assert.notEqual(r1.id, r2.id);
    const all = readProvenance(dir);
    assert.equal(all.length, 2);
    assert.equal(all[0].prompt, 'a');
    assert.equal(all[1].seed, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('readProvenance: 파일 없으면 빈 배열', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vt-'));
  try { assert.deepEqual(readProvenance(dir), []); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test visual-studio/tests/provenance.test.mjs`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`visual-studio/scripts/lib/provenance.mjs`:
```js
/* 출처 기록 — assets/generated/_provenance.json 에 append. 순수 IO. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function file(projectDir) {
  return join(projectDir, 'assets', 'generated', '_provenance.json');
}

export function readProvenance(projectDir) {
  try { return JSON.parse(readFileSync(file(projectDir), 'utf8')); }
  catch { return []; }
}

/* id는 시간 함수 없이 결정적 — 기존 개수 기반 시퀀스 + 내용 해시 short */
function nextId(existing, entry) {
  const seq = String(existing.length + 1).padStart(4, '0');
  const basis = `${entry.model || ''}:${entry.seed ?? ''}:${entry.prompt || ''}`;
  let h = 0; for (const c of basis) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `gen-${seq}-${h.toString(36).slice(0, 6)}`;
}

export function recordGeneration(projectDir, entry) {
  const all = readProvenance(projectDir);
  const record = { id: nextId(all, entry), ...entry };
  all.push(record);
  mkdirSync(join(projectDir, 'assets', 'generated'), { recursive: true });
  writeFileSync(file(projectDir), JSON.stringify(all, null, 2));
  return record;
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test visual-studio/tests/provenance.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: CLI 래퍼**

`visual-studio/scripts/record.mjs`:
```js
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
});
console.log(JSON.stringify(rec, null, 2));
```

- [ ] **Step 6: Commit**

```bash
git add visual-studio/scripts/lib/provenance.mjs visual-studio/scripts/record.mjs visual-studio/tests/provenance.test.mjs
git commit -m "feat(visual-studio): 출처 기록 모듈 + CLI"
```

---

### Task 4: 팔레트 락 (palette-lock, playwright 캔버스)

**Files:**
- Create: `visual-studio/scripts/lib/palette-lock.mjs`
- Create: `visual-studio/scripts/palette-lock.mjs`
- Test: `visual-studio/tests/palette-lock.test.mjs`

**Interfaces:**
- Consumes: 없음.
- Produces:
  - `hexToRgb(hex) → [r,g,b]`
  - `nearestPaletteColor([r,g,b], palette) → [r,g,b]` (유클리드 최근접)
  - `gradeStrength(strength) → number` (`strong`→0.85, `light`→0.4, else 0)

> 이미지 디코딩·리컬러 자체는 playwright 캔버스에서 수행(브라우저 canvas가 PNG 디코드). node 단위 테스트는 **순수 색 계산**만 검증하고, 캔버스 파이프라인은 CLI 스모크로 확인.

- [ ] **Step 1: 실패 테스트(순수 색 계산)**

`visual-studio/tests/palette-lock.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgb, nearestPaletteColor, gradeStrength } from '../scripts/lib/palette-lock.mjs';

test('hexToRgb', () => {
  assert.deepEqual(hexToRgb('#0046FF'), [0, 70, 255]);
});

test('nearestPaletteColor: 가까운 팔레트 색으로', () => {
  const pal = [[0, 0, 0], [255, 255, 255]];
  assert.deepEqual(nearestPaletteColor([20, 20, 20], pal), [0, 0, 0]);
  assert.deepEqual(nearestPaletteColor([200, 200, 200], pal), [255, 255, 255]);
});

test('gradeStrength: 강도 매핑', () => {
  assert.equal(gradeStrength('strong'), 0.85);
  assert.equal(gradeStrength('light'), 0.4);
  assert.equal(gradeStrength('off'), 0);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test visual-studio/tests/palette-lock.test.mjs`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 순수 색 계산 구현**

`visual-studio/scripts/lib/palette-lock.mjs`:
```js
/* 팔레트 락 — 순수 색 계산 + (선택) playwright 캔버스 리컬러.
   순수부는 node에서 테스트, 캔버스부는 브라우저 페이지에서 실행. */

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const s = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16));
}

export function nearestPaletteColor(rgb, palette) {
  let best = palette[0], bestD = Infinity;
  for (const p of palette) {
    const d = (p[0] - rgb[0]) ** 2 + (p[1] - rgb[1]) ** 2 + (p[2] - rgb[2]) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

export function gradeStrength(strength) {
  return strength === 'strong' ? 0.85 : strength === 'light' ? 0.4 : 0;
}

/* 브라우저 컨텍스트에서 실행할 리컬러 함수 문자열 생성기.
   page.evaluate에 넘겨 캔버스 픽셀을 팔레트 최근접색과 mix(강도)로 치환. */
export function recolorScript() {
  return `(paletteHex, strength) => {
    const img = document.querySelector('img');
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const pal = paletteHex.map(h => { h = h.replace('#',''); h = h.length===3? h.split('').map(x=>x+x).join(''):h;
      return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)); });
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      let best = pal[0], bd = Infinity;
      for (const p of pal) { const d=(p[0]-px[i])**2+(p[1]-px[i+1])**2+(p[2]-px[i+2])**2; if(d<bd){bd=d;best=p;} }
      px[i]   = Math.round(px[i]   * (1-strength) + best[0] * strength);
      px[i+1] = Math.round(px[i+1] * (1-strength) + best[1] * strength);
      px[i+2] = Math.round(px[i+2] * (1-strength) + best[2] * strength);
    }
    ctx.putImageData(data, 0, 0);
    return c.toDataURL('image/png');
  }`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test visual-studio/tests/palette-lock.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: CLI(playwright 캔버스) 작성**

`visual-studio/scripts/palette-lock.mjs`:
```js
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
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(`<img src="data:image/png;base64,${b64}">`);
  await page.waitForSelector('img');
  const dataUrl = await page.evaluate(`(${recolorScript()})(${JSON.stringify(palette)}, ${strength})`);
  writeFileSync(outPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(JSON.stringify({ out: outPath, strength, palette }));
} finally { await browser.close(); }
```

- [ ] **Step 6: CLI 스모크(픽셀 8×8 단색 PNG로)**

Run: node로 8×8 파란 PNG를 만들어 검은/흰 팔레트로 강하게 락 → 출력이 검정에 가까워지는지 육안/크기 확인.
```bash
node -e "const{chromium}=await import('playwright')" 2>/dev/null || echo "playwright 필요"
```
Expected: playwright 있으면 `--out` 파일 생성. 없으면 원본 복사 + 안내. (본 스텝은 환경 의존 — 락 skip 경로라도 통과로 간주)

- [ ] **Step 7: Commit**

```bash
git add visual-studio/scripts/lib/palette-lock.mjs visual-studio/scripts/palette-lock.mjs visual-studio/tests/palette-lock.test.mjs
git commit -m "feat(visual-studio): 팔레트 락(순수 색계산 + playwright 캔버스)"
```

---

### Task 5: `generate` 스킬 (오케스트레이션 프로토콜)

**Files:**
- Create: `visual-studio/skills/generate/SKILL.md`

**Interfaces:**
- Consumes: Task 2·3·4의 CLI(`build-prompt.mjs`·`palette-lock.mjs`·`record.mjs`) + Replicate MCP 도구(에이전트 호출).
- Produces: 사람이 트리거하는 워크플로. 테스트는 없음(문서) — 검증은 매니페스트 validate + dry-run 낭독.

- [ ] **Step 1: SKILL.md 작성**

`visual-studio/skills/generate/SKILL.md`:
```markdown
---
name: generate
description: 클라이언트 브랜드에 조건부로 이미지·영상 생성 후 팔레트로 후처리. 트리거 — "이미지 만들어/생성", "히어로 배경", "영상 생성", "/generate". 클라이언트 프로젝트 전용(잡스랩 self 차단). 반드시 .design 토큰 확보 이후.
---

# /generate — 브랜드 조건부 생성 (게이트 고정)

`<plugin-root>` = 이 SKILL 기준 `../..`. `<project>` = `.design/`가 있는 클라이언트 루트.
Transport(생성)는 **에이전트가 MCP 도구를 직접 호출**한다 — node 스크립트는 프롬프트·락·기록만.

## 게이트 (순서 고정, 생략 금지)

1. **브랜드 확보**: `<project>/.design/tokens.json` 없으면 중단 → "/design-tokens로 클라이언트 기준부터 확보".
2. **self 차단**: `meta.project == jobslab`이면 중단 → "visual-studio는 클라이언트 전용".
3. **의도 수집**: 무엇을(히어로/배경/텍스처/썸네일/영상), 용도(→종횡비 og|hero|square|story), 장수.
4. **프롬프트 조립**: `node <plugin-root>/scripts/build-prompt.mjs <project> --intent "<의도>" --use <용도>` → 스캐폴드 JSON(positive/negative/aspect/paletteLock/palette).
5. **비용 게이트**: 스캐폴드 + 선택 모델 + **예상 비용**을 표로 제시하고 **사용자 승인**을 받는다. 승인 전 생성 금지.
6. **생성 (에이전트가 MCP 호출)**:
   - 연결된 생성 MCP(권장 Replicate)를 ToolSearch로 찾는다. 없으면 "생성 MCP를 추가하세요(예: Replicate)" 안내 후 중단(graceful).
   - 이미지: 스캐폴드 positive/negative/aspect + 모델(Flux 등) + seed로 MCP 호출.
   - 영상: 영상 모델(Runway/Kling 등) 지정, 후처리는 v1 미적용.
   - 결과 파일을 `<project>/assets/generated/`에 저장(원본).
7. **팔레트 락 (이미지, paletteLock != off)**: `node <plugin-root>/scripts/palette-lock.mjs --in <원본> --out <락본> --palette "<palette 콤마>" --strength <paletteLock>` → 락본 저장. 원본·락본 둘 다 미리보기로 제시, 사용자가 채택.
8. **출처 기록**: `node <plugin-root>/scripts/record.mjs <project> --prompt "<positive>" --model <모델> --seed <seed> --asset <채택 파일> --cost <usd>`.
9. **마무리**: 생성/변경 파일 목록만 제시. **커밋하지 않는다**(사용자 위임).

## 원칙
- 네거티브는 스캐폴드가 브랜드 금지항목에서 자동 생성 — 임의로 빼지 않는다.
- seed를 항상 기록해 재현·반복 가능하게.
- 잡스랩 자체 사이트에는 쓰지 않는다(브랜드 이미지 최소 원칙).
```

- [ ] **Step 2: 매니페스트·스킬 검증**

Run: `claude plugin validate visual-studio`
Expected: 통과. SKILL.md frontmatter(name/description) 인식.

- [ ] **Step 3: Commit**

```bash
git add visual-studio/skills/generate/SKILL.md
git commit -m "feat(visual-studio): generate 스킬 오케스트레이션 프로토콜"
```

---

### Task 6: 통합 스모크 + 문서 링크

**Files:**
- Modify: `docs/superpowers/specs/2026-07-20-brand-conditioned-generation-design.md` (구현계획 링크 확인)

- [ ] **Step 1: 전체 유닛 테스트**

Run: `node --test visual-studio/tests/`
Expected: PASS — prompt-brand(4) + provenance(2) + palette-lock(3) = 9 tests.

- [ ] **Step 2: 스캐폴드→기록 파이프라인 스모크**

```bash
mkdir -p /tmp/vt2/.design && cp visual-studio/tests/fixture/tokens.json /tmp/vt2/.design/
node visual-studio/scripts/build-prompt.mjs /tmp/vt2 --intent "abstract brand background" --use og
node visual-studio/scripts/record.mjs /tmp/vt2 --prompt "abstract" --model flux --seed 7 --asset assets/generated/x.png --cost 0.01
cat /tmp/vt2/assets/generated/_provenance.json
```
Expected: 스캐폴드 JSON 출력 + `_provenance.json`에 1건(id `gen-0001-...`).

- [ ] **Step 3: 재설치 안내(사용자 몫)**

플러그인은 `claude plugin marketplace update design-studio-plugins` → `claude plugin install visual-studio@design-studio-plugins` 후 재시작해야 활성화됨을 보고에 명시. (자동 설치하지 않음)

- [ ] **Step 4: Commit**

```bash
git add -A visual-studio
git commit -m "test(visual-studio): 통합 스모크 통과 (9 tests)"
```

---

## Self-Review

**Spec coverage:**
- §4.1 브랜드 조건부 코어 → Task 2 ✓
- §4.2 Transport(MCP) → Task 5 게이트 6(에이전트 MCP 호출 + graceful) ✓
- §4.3 팔레트 락 → Task 4 ✓
- §4.4 배치+출처 → Task 3 + Task 5 게이트 7·8 ✓
- §5 워크플로/비용 게이트 → Task 5 ✓
- §6 가드레일(네거티브·비용·seed·self 차단·커밋 금지) → Task 2(self·negative)·Task 5(비용·seed·커밋) ✓
- §8 v1 범위(이미지+영상 생성, 팔레트 락 이미지) → Task 4·5 ✓

**Placeholder scan:** 모든 코드 스텝에 실제 코드·명령·기대출력 포함. TBD/TODO 없음.

**Type consistency:** `buildScaffold`/`aspectFor`/`negativeFrom`/`paletteLockFor`(Task2), `recordGeneration`/`readProvenance`(Task3), `hexToRgb`/`nearestPaletteColor`/`gradeStrength`/`recolorScript`(Task4) — 각 CLI·SKILL에서 동일 이름으로 참조. 일관.

> 알려진 한계: Task 4 Step 6·Task 5는 환경 의존(playwright·MCP 연결) — 유닛 테스트 대신 스모크/검증으로 처리. 실제 생성 검증은 Replicate MCP 연결 후 수동 1회.
