# 클라이언트 맥시멀 아스날 + DaisyUI 포맷 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** DaisyUI를 토큰 파이프라인의 세 번째 출력 포맷으로 추가하고, 클라이언트 맥시멀 리소스 레지스트리 스킬 `arsenal`을 만든다.

**Architecture:** DaisyUI 실코드는 design-check `tokens-to-code`의 `--format daisyui`(tokens.json 소비 — 별도 시스템 아님). arsenal은 design-studio 새 스킬(레지스트리 JSON + 워크플로, 토큰 권한 없음).

**Tech Stack:** Node ESM(.mjs), node:test/assert.

## Global Constraints
- ESM `.mjs`, 외부 npm 의존 추가 금지(node 표준만).
- DaisyUI는 **출력 포맷**일 뿐 — 디자인시스템 정의·변경은 studio/design-tokens(tokens.json 유일 원천). arsenal은 토큰을 정의·변경하지 않는다.
- 생성물 커밋 금지(문서 안내만). Origin UI 제외.
- 결정적 출력(시간 함수 없음).
- 커밋 메시지 끝: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure
- `design-check/scripts/lib/tokens.mjs` — `daisyTheme(tokens)` 추가(Modify)
- `design-check/scripts/tokens-to-code.mjs` — `--format daisyui` 분기(Modify)
- `design-check/tests/daisy-theme.test.mjs` — 테스트(Create)
- `design-check/skills/design-inject/SKILL.md` — daisyui 포맷 한 줄(Modify, 있으면)
- `design-check/.claude-plugin/plugin.json` — 1.3.0→1.4.0(Modify)
- `design-studio/skills/arsenal/registry.json` — 리소스 4종(Create)
- `design-studio/skills/arsenal/SKILL.md` — 워크플로(Create)
- `design-studio/.claude-plugin/plugin.json` — 1.2.0→1.3.0(Modify)

---

### Task 1: design-check — DaisyUI 출력 포맷

**Files:**
- Modify: `design-check/scripts/lib/tokens.mjs` (daisyTheme 추가)
- Modify: `design-check/scripts/tokens-to-code.mjs` (format 분기)
- Create: `design-check/tests/daisy-theme.test.mjs`
- Modify: `design-check/.claude-plugin/plugin.json` (버전)

**Interfaces:**
- Produces: `daisyTheme(tokens) → cssString` (`@plugin "daisyui/theme"` 블록). `--format daisyui` → `.design/tokens.daisyui.css`.

- [ ] **Step 1: 실패 테스트**

`design-check/tests/daisy-theme.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daisyTheme } from '../scripts/lib/tokens.mjs';

const tokens = { meta:{project:'acme'}, color:{primary:'#0046FF',bg:'#FFFFFF',surface:'#F7F7FB',text:'#111111',muted:'#6B6980'}, radius:{base:'2px',card:'2px'} };

test('daisyTheme: @plugin 블록 + tokens 매핑', () => {
  const css = daisyTheme(tokens);
  assert.match(css, /@plugin "daisyui\/theme"/);
  assert.match(css, /name: "acme"/);
  assert.match(css, /--color-primary: #0046FF/);
  assert.match(css, /--color-base-100: #FFFFFF/);
  assert.match(css, /--color-base-200: #F7F7FB/);
  assert.match(css, /--color-base-content: #111111/);
  assert.match(css, /--color-neutral: #6B6980/);
  assert.match(css, /--radius-box: 2px/);
});

test('daisyTheme: project 없으면 custom', () => {
  const css = daisyTheme({ color:{primary:'#111111',bg:'#fff',surface:'#eee',text:'#000',muted:'#888'}, radius:{base:'4px'} });
  assert.match(css, /name: "custom"/);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test design-check/tests/daisy-theme.test.mjs`
Expected: FAIL — `daisyTheme` export 없음.

- [ ] **Step 3: daisyTheme 구현 (lib/tokens.mjs 끝에 추가)**

`design-check/scripts/lib/tokens.mjs` 파일 끝에 추가(기존 export·`expandHex`는 그대로):
```js
/* tokens-v1 → DaisyUI 테마. 신뢰 가능한 필드만 매핑, 나머지는 DaisyUI 기본 상속. 결정적. */
export function daisyTheme(tokens) {
  const c = tokens.color || {}, r = tokens.radius || {};
  const pairs = [
    ['--color-primary', expandHex(c.primary)],
    ['--color-base-100', expandHex(c.bg)],
    ['--color-base-200', expandHex(c.surface)],
    ['--color-base-content', expandHex(c.text)],
    ['--color-neutral', expandHex(c.muted)],
    ['--radius-selector', r.base],
    ['--radius-field', r.base],
    ['--radius-box', r.card || r.base],
  ].filter(([, v]) => v);
  const body = pairs.map(([k, v]) => `  ${k}: ${v};`).join('\n');
  const name = (tokens.meta && tokens.meta.project) || 'custom';
  return `@plugin "daisyui/theme" {\n  name: "${name}";\n  default: true;\n  color-scheme: light;\n${body}\n}\n`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test design-check/tests/daisy-theme.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: tokens-to-code.mjs에 daisyui 포맷 분기**

`design-check/scripts/tokens-to-code.mjs` 수정 3곳:
1. import에 daisyTheme 추가:
```js
import { validateTokens, expandHex, contrastOn, daisyTheme } from './lib/tokens.mjs';
```
2. format 허용 목록:
```js
if (!['css', 'tailwind', 'all', 'daisyui'].includes(format)) {
  console.error('--format은 css | tailwind | all | daisyui 중 하나'); process.exit(1);
}
```
3. write 분기(기존 css/tailwind 블록 뒤, `console.log` 앞에 추가):
```js
if (format === 'daisyui' || format === 'all') {
  const head = `/* AUTO-GENERATED — .design/tokens.json에서 생성. 손으로 수정 금지.\n   재생성: node <design-check-root>/scripts/tokens-to-code.mjs <프로젝트> --format daisyui\n   project: ${tokens.meta?.project || '-'} */\n`;
  const p = join(dir, '.design', 'tokens.daisyui.css');
  writeFileSync(p, head + daisyTheme(tokens)); written.push(p);
}
```

- [ ] **Step 6: CLI 스모크**

```bash
mkdir -p /tmp/dz/.design && printf '{"$schema":"design-studio/tokens-v1","meta":{"project":"acme"},"color":{"primary":"#0046FF","onPrimary":"#FFFFFF","bg":"#FFFFFF","surface":"#F7F7FB","text":"#111111","muted":"#6B6980"},"radius":{"base":"2px","card":"2px"},"spacing":{"unit":"8px"}}' > /tmp/dz/.design/tokens.json
node design-check/scripts/tokens-to-code.mjs /tmp/dz --format daisyui
cat /tmp/dz/.design/tokens.daisyui.css
```
Expected: `@plugin "daisyui/theme"` 블록, `--color-primary: #0046FF`, `--radius-box: 2px` 포함. exit 0.

- [ ] **Step 7: 사용법 주석 + 버전 + Commit**

- `tokens-to-code.mjs` 상단 사용법 주석 3행을 `[--format css|tailwind|daisyui|all]`로, 출력 설명에 `tokens.daisyui.css (daisyui, @plugin theme)` 추가.
- `design-check/skills/design-inject/SKILL.md`가 있으면 포맷 목록에 `daisyui`(클라이언트 DaisyUI 시안용) 한 줄 추가. 없으면 생략하고 리포트에 적기.
- `design-check/.claude-plugin/plugin.json` version `1.3.0` → `1.4.0`.

```bash
git add design-check/scripts/lib/tokens.mjs design-check/scripts/tokens-to-code.mjs design-check/tests/daisy-theme.test.mjs design-check/.claude-plugin/plugin.json design-check/skills/design-inject/SKILL.md
git commit -m "feat(design-check): DaisyUI 출력 포맷(--format daisyui) v1.4.0"
```

---

### Task 2: arsenal 리소스 레지스트리

**Files:**
- Create: `design-studio/skills/arsenal/registry.json`

**Interfaces:**
- Produces: 리소스 4종 레지스트리(스킬이 조회).

- [ ] **Step 1: registry.json 작성**

`design-studio/skills/arsenal/registry.json`:
```json
{
  "$schema": "design-studio/arsenal-v1",
  "note": "클라이언트 맥시멀 작업용 외부 리소스. 잡스랩 자체(미니멀) 사이트엔 쓰지 않음.",
  "resources": [
    {
      "id": "casberry",
      "label": "Particles (Casberry)",
      "forWhat": "화려한 3D 파티클 히어로 배경",
      "pull": "웹 생성기 particles.casberry.in에서 바닐라 JS 단일 HTML export(Three.js CDN 포함)",
      "stackFit": "both",
      "brandNote": "클라이언트 히어로 전용. 잡스랩 자체 사이트엔 금물(장식0 원칙).",
      "maximalTier": "high"
    },
    {
      "id": "originkit",
      "label": "OriginKit",
      "forWhat": "리치 랜딩 모션 컴포넌트",
      "pull": "originkit.dev — Magic 유사 MCP(fetch 캡) 또는 코드 복사. React/Framer 지향.",
      "stackFit": "react",
      "brandNote": "정적 사이트엔 어댑트 필요. 모션 톤이 강함.",
      "maximalTier": "high"
    },
    {
      "id": "21st-magic",
      "label": "21st.dev Magic",
      "forWhat": "React 컴포넌트 AI 생성(검증된 라이브러리 조각 기반)",
      "pull": "Magic MCP 연결 후 자연어 호출(/ui). shadcn/Tailwind 산출.",
      "stackFit": "react",
      "brandNote": "커뮤니티 코드 — 신뢰 못 할 입력으로 취급. 정적엔 변환 부담.",
      "maximalTier": "mid"
    },
    {
      "id": "daisyui",
      "label": "DaisyUI",
      "forWhat": "클라이언트 초고속 프로토타이핑(테마 35종)",
      "pull": "클라이언트 tokens.json에서 'design-inject --format daisyui'로 테마 생성 + CDN(daisyui@5 + tailwind browser).",
      "stackFit": "both",
      "brandNote": "자체 DS의 .btn과 클래스 충돌 — 클라이언트 시안에 격리 사용. 시스템 정의가 아니라 tokens 소비 포맷.",
      "maximalTier": "mid"
    }
  ]
}
```

- [ ] **Step 2: JSON 유효성 + Commit**

Run: `python3 -c "import json;d=json.load(open('design-studio/skills/arsenal/registry.json'));assert len(d['resources'])==4;print('ok', [r['id'] for r in d['resources']])"`
Expected: `ok ['casberry', 'originkit', '21st-magic', 'daisyui']`

```bash
git add design-studio/skills/arsenal/registry.json
git commit -m "feat(arsenal): 클라이언트 맥시멀 리소스 레지스트리 4종"
```

---

### Task 3: arsenal 스킬 + 버전

**Files:**
- Create: `design-studio/skills/arsenal/SKILL.md`
- Modify: `design-studio/.claude-plugin/plugin.json` (1.2.0→1.3.0)

**Interfaces:**
- Consumes: `registry.json`(Task 2), design-check `--format daisyui`(Task 1).

- [ ] **Step 1: SKILL.md 작성**

`design-studio/skills/arsenal/SKILL.md`:
```markdown
---
name: arsenal
description: 클라이언트 맥시멀 작업용 외부 리소스(화려한 3D 파티클·리치 모션 컴포넌트·빠른 시안) 매칭. 트리거 — "화려한 히어로/배경", "파티클", "리치 모션 컴포넌트", "빠른 시안/프로토타입", "/arsenal". 클라이언트 작업용(잡스랩 자체 미니멀 사이트엔 말림). 디자인시스템 정의·변경이 아님 — 그건 /design-tokens·/studio.
---

# /arsenal — 클라이언트 맥시멀 리소스 매칭

`<plugin-root>` = 이 SKILL 기준 `../..`. **이 스킬은 토큰을 정의·변경하지 않는다** — 디자인시스템 변경 의도("토큰/primary/디자인시스템 바꾸기")는 `/design-tokens`·`/studio`로 보낸다.

1. **self 경고**: 대상 프로젝트 `.design/tokens.json`의 `meta.project == jobslab`이면 "맥시멀 리소스는 클라이언트 작업용 — 잡스랩 자체 사이트는 미니멀(장식0) 유지"라고 경고. 참고 조회는 계속 허용.
2. **니즈 수집**: 무엇이 필요한가 — 화려한 히어로 배경 / 리치 모션 컴포넌트 / 빠른 컴포넌트 시안 / AI 컴포넌트 생성.
3. **레지스트리 조회**: `<plugin-root>/skills/arsenal/registry.json`을 읽어 니즈에 맞는 리소스의 `forWhat`·`pull`·`stackFit`·`brandNote`를 제시. 클라이언트 스택(정적/React)에 맞는 것 우선.
4. **DaisyUI 경로**: 빠른 시안이면 DaisyUI를 권하되, 코드 변환을 여기서 하지 않는다 — "`design-check`의 `/design-inject`(또는 `tokens-to-code.mjs --format daisyui`)로 **클라이언트 tokens.json에서 DaisyUI 테마를 뽑아** CDN 시안에 주입"하도록 안내. (DaisyUI는 우리 토큰의 출력 포맷이지 별도 디자인시스템이 아님.)
5. **커밋 금지** — 가져온 리소스·시안은 변경 목록만 제시, 커밋은 사용자 위임.

## 원칙
- 잡스랩 자체 사이트엔 맥시멀 리소스를 적용하지 않는다(미니멀은 자체 브랜드 철학).
- Origin UI는 레지스트리에 없다(21st·자체 DS 중복 + legacy).
- DaisyUI 컴포넌트는 자체 DS와 `.btn` 등 클래스가 충돌 — 클라이언트 시안에 격리 사용, 한 페이지 혼용 금지.
```

- [ ] **Step 2: 버전 + 검증**

- `design-studio/.claude-plugin/plugin.json` version `1.2.0` → `1.3.0`. description 끝에 "+ /arsenal(클라이언트 맥시멀 리소스 매칭)" 추가.
- Run: `claude plugin validate design-studio` (안 되면 SKILL frontmatter YAML 유효성 python 확인). Expected: 통과.

- [ ] **Step 3: Commit**

```bash
git add design-studio/skills/arsenal/SKILL.md design-studio/.claude-plugin/plugin.json
git commit -m "feat(arsenal): arsenal 스킬 + design-studio v1.3.0"
```

---

## Self-Review
- Spec §4.1 DaisyUI 포맷 → Task 1 ✓
- Spec §4.2 레지스트리 → Task 2 ✓
- Spec §4.3 arsenal 스킬(토큰 권한 없음, DaisyUI 포인터) → Task 3 ✓
- Global: DaisyUI=포맷(별도 시스템 아님), arsenal 토큰 정의 안 함 → Task 1(lib/generator)·Task 3(SKILL 명시) ✓
- 라우팅 중복 0: SKILL description이 "디자인시스템 정의·변경이 아님 — /design-tokens·/studio"를 명시 → Task 3 ✓
- Placeholder 없음, 타입 일관(daisyTheme).
