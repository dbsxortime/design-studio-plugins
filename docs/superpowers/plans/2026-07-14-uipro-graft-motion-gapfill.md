# design-studio 스킬 강화: uipro 데이터 접목 + 모션 갤러리 갭필 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (A) ui-ux-pro-max 오픈소스의 산업별 디자인 지식 데이터를 design-check 플러그인에 반입하고 /design-tokens 온보딩을 "업종 질문 → 데이터 기반 시안 → 목업 → 디테일 조정 루프"로 개편, (B) 모션 갤러리 142종에 framer-motion(Motion) 대표 패턴 중 누락된 8종을 추가한다.

**Architecture:** 데이터는 CSV 원본 그대로 `design-check/data/uipro/`에 반입(MIT 고지 동반)하고, node 표준 라이브러리만 쓰는 조회 CLI(`uipro-lookup.mjs`)로 검색한다. 온보딩 개편은 design-tokens SKILL.md의 경로 ③ 교체(에이전트가 런타임에 CLI를 호출해 시안·목업 생성). 모션 갭필은 `design-studio/assets/studio.html`의 MOTIONS 배열에 항목 추가 + 데모용 키프레임 추가.

**Tech Stack:** Node 18+ (.mjs, node:test), Motion(구 framer-motion) v12 — `motion/react` 임포트 경로, Python 불사용(원본 search.py는 이식하지 않고 자체 경량 조회기 작성).

## Global Constraints

- **커밋 금지** — 변경은 워킹트리에 남기고 목록만 보고, 커밋은 사용자 위임 (전역 CLAUDE.md Git 규칙)
- **새 npm 의존성 금지** — node 표준 라이브러리만 (저장소 관례)
- **폰트 데이터 반입 금지** — typography.csv·google-fonts.csv는 복사하지 않는다. 한글 폰트 질문은 기존 스킬 로직 유지
- **원본 데이터 출처**: `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill` (MIT). 클론 위치가 없으면 `git clone --depth 1` 후 진행. LICENSE 사본 필수
- **studio.html MOTIONS 형식 준수**: 필수 필드 `id,cat,title,code`, `links=[['라벨','url'],...]`, `lic:'mit'`(Motion은 MIT), 데모 키프레임은 `m` 접두사 고유명으로 288행 부근 키프레임 블록에 추가
- **tokens-v1 스키마 하위호환**: 확장은 `meta.uipro{...}` 서브필드로만. 기존 필드 구조 변경 금지
- **`:28572` 포트(스튜디오) 사용 금지** — 목업 서빙은 28574
- 원본 클론 경로(이 세션): `/private/tmp/claude-501/-Users-park-yuntaek-Documents---------/c81c9d4b-08e8-43ad-a245-ad5f34b541b8/scratchpad/uiuxpromax`
- 대상 저장소: `/Users/park-yuntaek/Documents/GitHub/playground/design-studio-plugins` (이하 `<repo>`)

---

### Task 1: uipro 데이터 반입 (design-check/data/uipro/)

**Files:**
- Create: `<repo>/design-check/data/uipro/colors.csv` (원본 복사)
- Create: `<repo>/design-check/data/uipro/styles.csv` (원본 복사)
- Create: `<repo>/design-check/data/uipro/ui-reasoning.csv` (원본 복사)
- Create: `<repo>/design-check/data/uipro/landing.csv` (원본 복사)
- Create: `<repo>/design-check/data/uipro/LICENSE` (원본 LICENSE 복사)
- Create: `<repo>/design-check/data/uipro/README.md`

**Interfaces:**
- Produces: Task 2의 lookup CLI가 읽는 4개 CSV. 헤더(원본 그대로):
  - colors.csv: `No,Product Type,Primary,On Primary,Secondary,On Secondary,Accent,On Accent,Background,Foreground,Card,Card Foreground,Muted,Muted Foreground,Border,Destructive,On Destructive,Ring,Notes`
  - ui-reasoning.csv: `No,UI_Category,Recommended_Pattern,Style_Priority,Color_Mood,Typography_Mood,Key_Effects,Decision_Rules,Anti_Patterns,Severity`
  - styles.csv: `No,Style Category,Type,Keywords,Primary Colors,Secondary Colors,Effects & Animation,Best For,Do Not Use For,...`
  - landing.csv: `No,Pattern Name,Keywords,Section Order,Primary CTA Placement,Color Strategy,Recommended Effects,Conversion Optimization`

- [ ] **Step 1: 원본 확보 확인 후 복사**

```bash
SRC="/private/tmp/claude-501/-Users-park-yuntaek-Documents---------/c81c9d4b-08e8-43ad-a245-ad5f34b541b8/scratchpad/uiuxpromax"
[ -d "$SRC" ] || git clone --depth 1 https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git "$SRC"
REPO="/Users/park-yuntaek/Documents/GitHub/playground/design-studio-plugins"
mkdir -p "$REPO/design-check/data/uipro"
for f in colors.csv styles.csv ui-reasoning.csv landing.csv; do
  cp "$SRC/src/ui-ux-pro-max/data/$f" "$REPO/design-check/data/uipro/$f"
done
cp "$SRC/LICENSE" "$REPO/design-check/data/uipro/LICENSE"
```

- [ ] **Step 2: README.md 작성** (아래 내용 그대로)

```markdown
# uipro 데이터 (반입본)

출처: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill (MIT — LICENSE 참조)
반입일: 2026-07-14 · 반입 파일 4종 (폰트 데이터는 의도적으로 제외 — 한글 폰트는 자체 목록 사용)

| 파일 | 내용 | 행 수 |
|------|------|------|
| colors.csv | 산업별 색 팔레트 | ~192 |
| styles.csv | UI 스타일 사전 | ~84 |
| ui-reasoning.csv | 산업별 판단 규칙(스타일 우선순위·금기) | ~161 |
| landing.csv | 랜딩 페이지 구성 패턴 | 원본 참조 |

조회: `node design-check/scripts/uipro-lookup.mjs "<english keywords>" --json`
갱신: 원본 저장소 재클론 후 위 4개 파일 재복사 (수기 편집 금지)
```

- [ ] **Step 3: 검증**

```bash
wc -l "$REPO/design-check/data/uipro/"*.csv
```
Expected: colors ≥190, styles ≥80, ui-reasoning ≥160, landing ≥10 행. LICENSE 파일 존재.

---

### Task 2: uipro-lookup.mjs 조회 CLI + 테스트

**Files:**
- Create: `<repo>/design-check/scripts/uipro-lookup.mjs`
- Test: `<repo>/tests/uipro.test.mjs`

**Interfaces:**
- Produces: CLI `node design-check/scripts/uipro-lookup.mjs "<query>" [--json]`
  - 반환 JSON 형태(Task 3의 SKILL.md가 참조):
    `{ query, colors:{productType,primary,onPrimary,secondary,accent,background,foreground,card,muted,border,destructive,ring,notes}, reasoning:{category,pattern,stylePriority,colorMood,keyEffects,antiPatterns,severity}, style:{name,keywords,effects,bestFor,avoidFor}, landing:{name,sections,cta,colorStrategy,effects}|null }`

- [ ] **Step 1: 실패 테스트 작성** — `tests/uipro.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';

const run = a => execFileSync('node', ['design-check/scripts/uipro-lookup.mjs', ...a], { encoding: 'utf8' });

test('uipro-lookup: 업종별로 다른 시스템이 나온다', () => {
  const yoga = JSON.parse(run(['yoga wellness booking', '--json']));
  const fin = JSON.parse(run(['fintech payment trust', '--json']));
  assert.match(yoga.colors.primary, /^#[0-9A-Fa-f]{6}$/);
  assert.match(fin.colors.primary, /^#[0-9A-Fa-f]{6}$/);
  assert.notEqual(yoga.colors.primary, fin.colors.primary);
  assert.ok(yoga.style.name && fin.style.name);
  assert.ok(yoga.reasoning.antiPatterns.length > 0);
});

test('uipro-lookup: 데이터 무결성', () => {
  const out = JSON.parse(run(['saas dashboard', '--json']));
  for (const k of ['primary','background','foreground']) assert.ok(out.colors[k], `colors.${k} 누락`);
  assert.ok(out.reasoning.pattern, 'reasoning.pattern 누락');
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd <repo> && node --test tests/uipro.test.mjs`
Expected: FAIL (`uipro-lookup.mjs` 없음 — MODULE_NOT_FOUND)

- [ ] **Step 3: 구현** — `design-check/scripts/uipro-lookup.mjs` (전문)

```js
#!/usr/bin/env node
// uipro-lookup — ui-ux-pro-max 반입 데이터(design-check/data/uipro)를 키워드로 조회.
// 사용: node uipro-lookup.mjs "<english keywords>" [--json]
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'uipro');

function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length > 2).map(r =>
    Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || '').trim()])));
}
const load = f => parseCSV(readFileSync(join(DATA, f), 'utf8'));

function score(query, text) {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1);
  const t = text.toLowerCase();
  let s = 0;
  for (const w of words) {
    if (new RegExp(`\\b${w}\\b`).test(t)) s += 2;
    else if (t.includes(w)) s += 1;
  }
  return s;
}
function best(rows, query, cols) {
  let top = rows[0], topS = -1;
  for (const r of rows) {
    const s = score(query, cols.map(c => r[c] || '').join(' '));
    if (s > topS) { topS = s; top = r; }
  }
  return top;
}

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const query = args.filter(a => a !== '--json').join(' ');
if (!query) { console.error('usage: uipro-lookup.mjs "<english keywords>" [--json]'); process.exit(1); }

const colors = best(load('colors.csv'), query, ['Product Type', 'Notes']);
const reasoning = best(load('ui-reasoning.csv'), query, ['UI_Category', 'Recommended_Pattern', 'Color_Mood']);
const styles = load('styles.csv');
// 스타일: 판단 규칙의 Style_Priority 첫 항목과 이름이 맞는 행 우선, 없으면 쿼리 매칭
const priName = (reasoning['Style_Priority'] || '').split('+')[0].trim();
const style = styles.find(s => priName && s['Style Category'].toLowerCase().includes(priName.toLowerCase()))
  || best(styles, query, ['Style Category', 'Keywords', 'Best For']);
const landingRow = best(load('landing.csv'), `${reasoning['Recommended_Pattern']} ${query}`, ['Pattern Name', 'Keywords']);

const out = {
  query,
  colors: {
    productType: colors['Product Type'], primary: colors['Primary'], onPrimary: colors['On Primary'],
    secondary: colors['Secondary'], accent: colors['Accent'], background: colors['Background'],
    foreground: colors['Foreground'], card: colors['Card'], muted: colors['Muted'],
    border: colors['Border'], destructive: colors['Destructive'], ring: colors['Ring'], notes: colors['Notes'],
  },
  reasoning: {
    category: reasoning['UI_Category'], pattern: reasoning['Recommended_Pattern'],
    stylePriority: reasoning['Style_Priority'], colorMood: reasoning['Color_Mood'],
    keyEffects: reasoning['Key_Effects'], antiPatterns: reasoning['Anti_Patterns'], severity: reasoning['Severity'],
  },
  style: {
    name: style['Style Category'], keywords: style['Keywords'], effects: style['Effects & Animation'],
    bestFor: style['Best For'], avoidFor: style['Do Not Use For'],
  },
  landing: landingRow ? {
    name: landingRow['Pattern Name'], sections: landingRow['Section Order'],
    cta: landingRow['Primary CTA Placement'], colorStrategy: landingRow['Color Strategy'],
    effects: landingRow['Recommended Effects'],
  } : null,
};

if (asJson) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`[${out.colors.productType}] ${out.style.name}`);
  console.log(`primary ${out.colors.primary} · bg ${out.colors.background} · accent ${out.colors.accent} — ${out.colors.notes}`);
  console.log(`패턴: ${out.reasoning.pattern} / 피할 것: ${out.reasoning.antiPatterns}`);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd <repo> && node --test tests/uipro.test.mjs`
Expected: PASS 2건

---

### Task 3: /design-tokens SKILL.md 온보딩 개편

**Files:**
- Modify: `<repo>/design-check/skills/design-tokens/SKILL.md` — 경로 `③ 채팅 온보딩` 블록 전체 교체

**Interfaces:**
- Consumes: Task 2의 CLI와 JSON 필드명 (`colors.primary`, `reasoning.antiPatterns`, `landing.sections` 등)
- Produces: tokens.json `meta.uipro = { style, mood, pattern, avoid }` (신규 서브필드 — 다른 스크립트는 meta를 통과시키므로 하위호환)

- [ ] **Step 1: 기존 `③ 채팅 온보딩` 항목을 아래 텍스트로 교체** (①·② 경로와 저장 형식·onPrimary 규칙 등 나머지는 그대로 유지)

```markdown
- **③ 업종 온보딩** (신규 프로젝트 — 기준 파일이 없을 때만. 있으면 경로 ①이 우선):
  **3-a. 질문 (AskUserQuestion, 2개만)**: ⓐ "어떤 서비스인가요?" (자유 서술 허용 — 업종·타깃 한 줄)
  ⓑ 테마(라이트/다크). 폰트는 여기서 묻지 않는다(3-d에서 한글 폰트 기존 방식으로).
  **3-b. 데이터 조회**: 답변을 영문 키워드로 변환(예: "요가원 예약" → "yoga studio booking wellness")해
  `node <design-check-root>/scripts/uipro-lookup.mjs "<keywords>" --json` 실행.
  결과에서 시안 1세트 구성: 팔레트(스와치 표) + 스타일 + 무드 + 페이지 패턴 + 피할 것.
  ⚠️ 폰트 필드는 데이터에 없다 — 폰트 제안은 한글 폰트 목록에서 무드에 맞게 별도 제시.
  **3-c. 목업 제공**: 확인 기다리지 말고 바로 시안 값으로 `.design/preview/mockup.html` 생성.
  - 단일 파일, 시안 색을 `:root` CSS 변수(--color-primary 등)로 선언하고 전 요소가 변수만 참조
  - 섹션 구성은 landing.sections 순서를 따르되 실제 서비스 내용으로 카피 작성 (lorem 금지)
  - 서빙: `cd .design/preview && python3 -m http.server 28574 --bind 127.0.0.1` 백그라운드
    (**:28572 금지** — 스튜디오 포트). playwright로 `http://127.0.0.1:28574/mockup.html` 열어
    전체 스크린샷 캡처 후 사용자에게 제시. file:// 직접 열기 금지.
  **3-d. 디테일 단계 (확정까지 루프)**: 목업과 함께 시안 요약표(스타일/무드/패턴/피할 것/팔레트)를
  보여주고 조정 방법 2가지를 안내한다:
  - **텍스트 수정**: 사용자가 항목을 말로 수정("무드를 더 따뜻하게", "패턴에서 후기 섹션 빼줘",
    "primary는 #XXXXXX로") → 해당 값 갱신 → 목업 재생성·재캡처 → 다시 제시. 반복.
  - **스튜디오 수정**: "/studio를 열면 조합기에서 다른 시스템과 믹스하거나 토큰을 직접 편집할 수
    있습니다 — '기준 내보내기'로 tokens.json이 갱신되면 목업을 다시 만들어 보여드립니다."
    스튜디오 내보내기 후에는 갱신된 tokens.json 값으로 목업 재생성·재캡처.
  한글 폰트는 이 단계에서 확정(기존 폰트 질문 로직 — 시스템/Pretendard/세리프 + 무드 참고).
  **3-e. 확정 저장**: 승인 시 tokens-v1로 저장. onPrimary 자동 규칙(contrastOn) 그대로 적용.
  추가로 `meta.uipro = { style: <스타일명>, mood: <colorMood>, pattern: <landing.name>,
  avoid: <antiPatterns를 배열로> }` 기록 — 이후 /design-check·/brand가 참조 가능.
  서빙 프로세스 종료 후 기존 마무리(/studio·/design-inject 안내) 진행.
```

- [ ] **Step 2: 검증** — SKILL.md에 다음 마커가 모두 존재하는지 확인

```bash
grep -c "uipro-lookup.mjs\|28574\|meta.uipro\|목업 재생성" "$REPO/design-check/skills/design-tokens/SKILL.md"
```
Expected: 4개 마커 모두 1회 이상 (합계 ≥4)

---

### Task 4: 모션 갤러리 갭필 8종 (studio.html)

**Files:**
- Modify: `<repo>/design-studio/assets/studio.html` — ① 288행 부근 키프레임 블록에 신규 키프레임 8개 추가, ② MOTIONS 배열의 해당 카테고리 주석 블록 끝에 항목 삽입
- Modify: `<repo>/tests/motion.test.mjs` — 개수 기준 140→150, 신규 항목 검증 추가

**Interfaces:**
- Consumes: MOTIONS 항목 형식(`id,cat,title,lib,lic,stack,note,links,deps,demo,code`), `parseMotions()` 전제(자기완결 템플릿 리터럴)
- Produces: 신규 id 8종 — `drag-gesture, reorder-list, swipe-cards, shared-layout, layout-filter-grid, svg-path-draw, drag-carousel` (comp/sect), `cursor-follower` (page)

- [ ] **Step 1: 테스트 먼저 갱신** — `tests/motion.test.mjs`의 두 assert 수정·추가

```js
// 기존: assert.ok(m.length >= 140, ...) → 150으로
assert.ok(m.length >= 150, `expected >=150, got ${m.length}`);
// '카드 수·필드 무결성' 테스트 안에 추가:
const reorder = m.find(x => x.id === 'reorder-list');
assert.equal(reorder.cat, 'comp');
assert.ok(reorder.code.includes('Reorder'));
const cursor = m.find(x => x.id === 'cursor-follower');
assert.ok(cursor.code.includes('useSpring'));
```

- [ ] **Step 2: 실패 확인**

Run: `cd <repo> && node --test tests/motion.test.mjs`
Expected: FAIL (`expected >=150, got 142`)

- [ ] **Step 3: 키프레임 추가** — studio.html 288행 `@keyframes mSplitUp` 아래에 삽입

```css
@keyframes mDrift{0%,100%{transform:translate(0,0)}25%{transform:translate(26px,10px)}55%{transform:translate(8px,22px)}80%{transform:translate(30px,2px)}}
@keyframes mRowSwap{0%,35%{transform:translateY(0)}50%,85%{transform:translateY(26px)}100%{transform:translateY(0)}}
@keyframes mRowSwapB{0%,35%{transform:translateY(0)}50%,85%{transform:translateY(-26px)}100%{transform:translateY(0)}}
@keyframes mSwipeOut{0%,30%{transform:translateX(0) rotate(0)}60%{transform:translateX(90px) rotate(14deg);opacity:1}75%,100%{transform:translateX(140px) rotate(20deg);opacity:0}}
@keyframes mExpand{0%,40%{transform:scale(1)}60%,90%{transform:scale(1.9)}100%{transform:scale(1)}}
@keyframes mGridPop{0%,20%{transform:scale(0);opacity:0}40%,70%{transform:scale(1);opacity:1}90%,100%{transform:scale(0);opacity:0}}
@keyframes mDash{to{stroke-dashoffset:0}}
@keyframes mChase{0%{transform:translate(2px,26px)}30%{transform:translate(58px,6px)}65%{transform:translate(96px,30px)}100%{transform:translate(2px,26px)}}
@keyframes mTrackSlide{0%,25%{transform:translateX(0)}45%,70%{transform:translateX(-84px)}90%,100%{transform:translateX(0)}}
```

- [ ] **Step 4: MOTIONS 항목 8종 삽입** — 각 카테고리 주석 블록의 마지막(shds-* 앞이 아닌 블록 끝)에 추가. 전체 코드는 아래(줄바꿈·이스케이프 형식은 기존 항목과 동일하게, 템플릿 리터럴 내 백틱 금지 확인).

comp 블록 끝에 5종:

```js
{id:'drag-gesture',cat:'comp',title:'Drag 제스처 (constraints + elastic)',lib:'Motion',lic:'mit',
 stack:['Motion'],note:'영역 안에서 관성·탄성으로 끌 수 있는 요소. dragConstraints로 범위 제한, whileDrag로 들어올림 피드백. Motion 대표 기능인데 갤러리에 없던 기본기.',
 links:[['Motion drag','https://motion.dev/docs/react-gestures']],
 deps:'npm i motion',
 demo:`<div style="position:relative;width:150px;height:70px;border:1px dashed rgba(255,255,255,.3);border-radius:10px">
   <div style="width:34px;height:34px;border-radius:9px;background:#8b8bf5;margin:8px;animation:mDrift 3.2s ease-in-out infinite;box-shadow:0 6px 16px rgba(0,0,0,.3)"></div>
 </div>`,
 code:`import { motion } from "motion/react";

export function DragCard() {
  return (
    <div style={{ position: "relative", width: 320, height: 200 }}>
      <motion.div
        drag
        dragConstraints={{ top: 0, left: 0, right: 240, bottom: 120 }}
        dragElastic={0.2}
        whileDrag={{ scale: 1.08, boxShadow: "0 12px 32px rgba(0,0,0,.25)" }}
        style={{ width: 80, height: 80, borderRadius: 16, background: "#6366F1", cursor: "grab" }}
      />
    </div>
  );
}`},
{id:'reorder-list',cat:'comp',title:'Drag 재정렬 리스트 (Reorder)',lib:'Motion',lic:'mit',
 stack:['Motion'],note:'드래그로 순서를 바꾸는 리스트. Reorder.Group/Item 두 컴포넌트로 끝 — 정렬 애니메이션 자동. 할일·플레이리스트·우선순위 UI의 정석.',
 links:[['Motion Reorder','https://motion.dev/docs/react-reorder']],
 deps:'npm i motion',
 demo:`<div style="display:flex;flex-direction:column;gap:6px;width:130px">
   <div style="height:20px;border-radius:6px;background:#8b8bf5;animation:mRowSwap 2.8s ease-in-out infinite"></div>
   <div style="height:20px;border-radius:6px;background:rgba(255,255,255,.25);animation:mRowSwapB 2.8s ease-in-out infinite"></div>
   <div style="height:20px;border-radius:6px;background:rgba(255,255,255,.15)"></div>
 </div>`,
 code:`import { useState } from "react";
import { Reorder } from "motion/react";

export function ReorderList() {
  const [items, setItems] = useState(["기획", "디자인", "개발", "배포"]);
  return (
    <Reorder.Group axis="y" values={items} onReorder={setItems} style={{ listStyle: "none", padding: 0 }}>
      {items.map((item) => (
        <Reorder.Item key={item} value={item}
          whileDrag={{ scale: 1.03, boxShadow: "0 8px 24px rgba(0,0,0,.15)" }}
          style={{ padding: "12px 16px", marginBottom: 8, borderRadius: 10, background: "#fff", cursor: "grab" }}>
          {item}
        </Reorder.Item>
      ))}
    </Reorder.Group>
  );
}`},
{id:'swipe-cards',cat:'comp',title:'스와이프 카드 스택 (틴더식)',lib:'Motion',lic:'mit',
 stack:['Motion'],note:'가로로 끌어 임계값을 넘기면 회전하며 날아가고 다음 카드가 올라온다. useTransform으로 x→회전·투명도 연동, AnimatePresence로 퇴장. 선택 UI·온보딩 카드에.',
 links:[['Motion gestures','https://motion.dev/docs/react-gestures'],['AnimatePresence','https://motion.dev/docs/react-animate-presence']],
 deps:'npm i motion',
 demo:`<div style="position:relative;width:70px;height:90px">
   <div style="position:absolute;inset:0;border-radius:10px;background:rgba(255,255,255,.15);transform:scale(.92) translateY(6px)"></div>
   <div style="position:absolute;inset:0;border-radius:10px;background:#8b8bf5;animation:mSwipeOut 2.6s ease-in-out infinite"></div>
 </div>`,
 code:`import { useState } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "motion/react";

function Card({ label, onSwipe }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-18, 18]);
  const opacity = useTransform(x, [-200, -80, 0, 80, 200], [0, 1, 1, 1, 0]);
  return (
    <motion.div
      style={{ x, rotate, opacity, position: "absolute", inset: 0, borderRadius: 20, background: "#fff" }}
      drag="x" dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 120) onSwipe(label); }}
      exit={{ x: 400, opacity: 0, transition: { duration: 0.25 } }}
    >{label}</motion.div>
  );
}

export function SwipeDeck() {
  const [cards, setCards] = useState(["A", "B", "C"]);
  return (
    <div style={{ position: "relative", width: 240, height: 320 }}>
      <AnimatePresence>
        {cards.map((c) => (
          <Card key={c} label={c} onSwipe={(v) => setCards((cs) => cs.filter((x) => x !== v))} />
        ))}
      </AnimatePresence>
    </div>
  );
}`},
{id:'shared-layout',cat:'comp',title:'Shared Layout 확장 (layoutId)',lib:'Motion',lic:'mit',
 stack:['Motion'],note:'썸네일 카드가 그 자리에서 상세 뷰로 이어 늘어나는 매직 모션. 같은 layoutId 두 요소 사이를 Motion이 자동 보간. 갤러리→상세, 카드→모달 전환의 끝판.',
 links:[['Motion layout','https://motion.dev/docs/react-layout-animations']],
 deps:'npm i motion',
 demo:`<div style="width:36px;height:26px;border-radius:6px;background:#8b8bf5;animation:mExpand 3s cubic-bezier(.22,1,.36,1) infinite;transform-origin:center"></div>`,
 code:`import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export function ExpandCard() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <motion.div layoutId="card" onClick={() => setOpen(true)}
        style={{ width: 160, height: 100, borderRadius: 14, background: "#6366F1", cursor: "pointer" }} />
      <AnimatePresence>
        {open && (
          <motion.div layoutId="card" onClick={() => setOpen(false)}
            transition={{ type: "spring", bounce: 0.2 }}
            style={{ position: "fixed", inset: 40, borderRadius: 24, background: "#6366F1", zIndex: 50 }} />
        )}
      </AnimatePresence>
    </>
  );
}`},
{id:'drag-carousel',cat:'comp',title:'Drag 캐러셀 (관성 스냅)',lib:'Motion',lic:'mit',
 stack:['Motion'],note:'라이브러리 없이 Motion drag만으로 만드는 가로 캐러셀. dragTransition의 power·timeConstant로 관성 감쇠 조절. embla 없이 가볍게 갈 때.',
 links:[['Motion drag','https://motion.dev/docs/react-gestures']],
 deps:'npm i motion',
 demo:`<div style="width:140px;overflow:hidden"><div style="display:flex;gap:8px;animation:mTrackSlide 3.4s cubic-bezier(.22,1,.36,1) infinite">
   <div style="flex:0 0 60px;height:40px;border-radius:8px;background:#8b8bf5"></div>
   <div style="flex:0 0 60px;height:40px;border-radius:8px;background:rgba(255,255,255,.25)"></div>
   <div style="flex:0 0 60px;height:40px;border-radius:8px;background:rgba(255,255,255,.15)"></div>
 </div></div>`,
 code:`import { motion } from "motion/react";

export function DragCarousel({ slides }) {
  const W = 280; // 슬라이드 폭 + gap
  return (
    <div style={{ overflow: "hidden" }}>
      <motion.div
        drag="x"
        dragConstraints={{ right: 0, left: -((slides.length - 1) * W) }}
        dragElastic={0.08}
        dragTransition={{ power: 0.25, timeConstant: 180 }}
        style={{ display: "flex", gap: 16, cursor: "grab" }}
        whileTap={{ cursor: "grabbing" }}>
        {slides.map((s) => (
          <div key={s} style={{ flex: "0 0 264px", height: 160, borderRadius: 16, background: "#eee" }} />
        ))}
      </motion.div>
    </div>
  );
}`},
```

sect 블록 끝에 2종:

```js
{id:'layout-filter-grid',cat:'sect',title:'필터 그리드 재배치 (layout)',lib:'Motion',lic:'mit',
 stack:['Motion'],note:'필터를 바꾸면 남은 카드가 스프링으로 미끄러져 재배치되고 빠지는 카드는 축소 퇴장. layout prop + AnimatePresence 조합. 포트폴리오·상품 필터의 정석.',
 links:[['Motion layout','https://motion.dev/docs/react-layout-animations']],
 deps:'npm i motion',
 demo:`<div style="display:grid;grid-template-columns:repeat(3,26px);gap:5px">
   <div style="height:22px;border-radius:5px;background:#8b8bf5"></div>
   <div style="height:22px;border-radius:5px;background:rgba(255,255,255,.25);animation:mGridPop 2.8s ease-in-out infinite"></div>
   <div style="height:22px;border-radius:5px;background:#8b8bf5"></div>
   <div style="height:22px;border-radius:5px;background:rgba(255,255,255,.2);animation:mGridPop 2.8s ease-in-out .5s infinite"></div>
   <div style="height:22px;border-radius:5px;background:rgba(255,255,255,.15)"></div>
   <div style="height:22px;border-radius:5px;background:#8b8bf5;animation:mGridPop 2.8s ease-in-out 1s infinite"></div>
 </div>`,
 code:`import { useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";

export function FilterGrid({ items }) {
  const [tag, setTag] = useState("all");
  const shown = items.filter((i) => tag === "all" || i.tag === tag);
  return (
    <LayoutGroup>
      <div>{["all", "web", "brand"].map((t) => (
        <button key={t} onClick={() => setTag(t)}>{t}</button>
      ))}</div>
      <motion.ul layout style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, listStyle: "none", padding: 0 }}>
        <AnimatePresence>
          {shown.map((i) => (
            <motion.li key={i.id} layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", bounce: 0.25 }}
              style={{ height: 120, borderRadius: 14, background: "#eee" }} />
          ))}
        </AnimatePresence>
      </motion.ul>
    </LayoutGroup>
  );
}`},
{id:'svg-path-draw',cat:'sect',title:'SVG 라인 드로잉 (pathLength)',lib:'Motion',lic:'mit',
 stack:['Motion'],note:'뷰포트에 들어오면 선이 그려지는 SVG 애니메이션. pathLength 0→1 하나로 끝 — 서명·언더라인·다이어그램 연결선에. CSS만으로는 dasharray 수동 계산이 필요하던 것.',
 links:[['Motion SVG','https://motion.dev/docs/react-animation']],
 deps:'npm i motion',
 demo:`<svg viewBox="0 0 120 50" width="120" style="color:#8b8bf5">
   <path d="M6 40 Q30 4 60 24 T114 14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"
     stroke-dasharray="160" stroke-dashoffset="160" style="animation:mDash 2.2s ease-in-out infinite"/>
 </svg>`,
 code:`import { motion } from "motion/react";

export function PathDraw() {
  return (
    <svg viewBox="0 0 120 60" width={240}>
      <motion.path
        d="M6 48 Q30 6 60 30 T114 18"
        fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, ease: "easeInOut" }}
      />
    </svg>
  );
}`},
```

page 블록 끝에 1종:

```js
{id:'cursor-follower',cat:'page',title:'스프링 커서 팔로워',lib:'Motion',lic:'mit',
 stack:['Motion'],note:'포인터를 스프링 감쇠로 따라오는 커스텀 커서. useMotionValue+useSpring 두 줄이 핵심. stiffness/damping으로 쫀득함 조절. 에이전시·포트폴리오 사이트 시그니처.',
 links:[['useSpring','https://motion.dev/docs/react-use-spring']],
 deps:'npm i motion',
 demo:`<div style="position:relative;width:120px;height:56px">
   <div style="position:absolute;width:10px;height:10px;border-radius:50%;background:#fff;animation:mChase 3s cubic-bezier(.3,.7,.4,1) infinite"></div>
   <div style="position:absolute;width:22px;height:22px;border-radius:50%;border:1.5px solid #8b8bf5;margin:-6px;animation:mChase 3s cubic-bezier(.3,.7,.4,1) .12s infinite"></div>
 </div>`,
 code:`import { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

export function CursorFollower() {
  const mx = useMotionValue(-100);
  const my = useMotionValue(-100);
  const x = useSpring(mx, { stiffness: 300, damping: 28 });
  const y = useSpring(my, { stiffness: 300, damping: 28 });
  useEffect(() => {
    const move = (e) => { mx.set(e.clientX - 12); my.set(e.clientY - 12); };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);
  return (
    <motion.div style={{ x, y, position: "fixed", top: 0, left: 0, width: 24, height: 24,
      borderRadius: "50%", background: "#fff", mixBlendMode: "difference",
      pointerEvents: "none", zIndex: 9999 }} />
  );
}`},
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd <repo> && node --test tests/motion.test.mjs`
Expected: PASS (150개, reorder-list·cursor-follower 검증 포함)

- [ ] **Step 6: 스튜디오 렌더 실측** — 로컬 서빙 후 모션 랩 탭에서 신규 카드 8종 데모가 실제로 재생되는지 스크린샷 확인 (셀렉터 매치만으로 PASS 보고 금지)

```bash
cd <repo>/design-studio/assets && python3 -m http.server 28575 --bind 127.0.0.1 &
# playwright로 http://127.0.0.1:28575/studio.html 열기 → 모션 랩 탭 → 신규 카드 스크린샷 → 서버 종료
```

---

### Task 5: 버전 범프 + 전체 테스트

**Files:**
- Modify: `<repo>/design-check/.claude-plugin/plugin.json` — version 1.1.0 → 1.2.0
- Modify: `<repo>/design-studio/.claude-plugin/plugin.json` — version 1.0.0 → 1.1.0
- Modify: `<repo>/.claude-plugin/marketplace.json` — 두 플러그인의 version 표기가 있으면 동기화

- [ ] **Step 1: 버전 수정** (기능 추가 → minor)
- [ ] **Step 2: 전체 테스트**

Run: `cd <repo> && node --test tests/`
Expected: 전체 PASS (기존 19개 테스트 파일 + uipro.test.mjs)

---

### Task 6: 온보딩 리허설 (verification-before-completion)

**Files:** 생성물은 scratchpad에만 — 저장소·잡스랩 오염 금지

- [ ] **Step 1: 가짜 신규 프로젝트 리허설** — scratchpad에 빈 디렉토리를 만들고, 개편된 SKILL.md 흐름을 그대로 따라 "요가원 예약 서비스" 시나리오 실행: lookup 호출 → 시안 구성 → mockup.html 생성 → 28574 서빙 → playwright 스크린샷
- [ ] **Step 2: 판정 기준** — ⓐ lookup JSON의 색이 목업 CSS 변수에 그대로 반영 ⓑ 섹션 순서가 landing.sections와 일치 ⓒ 스크린샷에서 팔레트·라운드가 시안과 육안 일치 ⓓ 서빙 프로세스 정리 완료
- [ ] **Step 3: 완료 보고** — 변경 파일 전체 목록 + 테스트 결과 + 리허설 스크린샷 제시. 커밋은 사용자 위임
