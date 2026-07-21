---
name: design-inject
description: 확정 기준(.design/tokens.json)을 코드로 생성해 프로젝트에 심기 — 신규 프로젝트 첫 적용, 스튜디오 편집 직후 반영. 트리거 — "테마 적용해", "토큰 코드로 심어", "기준 반영해", "/design-inject".
---

# 기준을 코드로 심기 (inject)

## 철칙: 값을 손으로 옮기지 않는다
토큰 값(색·radius·폰트)을 읽고 CSS에 **직접 타이핑하는 것 금지** — 옮겨 적다 값이
바뀌는 손실의 원인. 값 변환은 전부 `tokens-to-code.mjs`(결정적 생성기)가 하고,
에이전트는 **생성 파일을 연결(배선)만** 한다.

## 순서

1. `.design/tokens.json` 없으면 중단 → `/design-tokens`로 기준부터 확보하라고 안내.
2. **포맷 감지**: 프로젝트가 Tailwind v4(`@import "tailwindcss"` 또는 package.json의
   `tailwindcss` v4)면 `tailwind`, DaisyUI 쓰면 `daisyui`, 아니면 `css`. 애매하면 한 줄 질문.
3. 생성: `node <design-check-root>/scripts/tokens-to-code.mjs <프로젝트> --format <포맷>`
   → `.design/tokens.css`(`:root` 변수), `.design/tokens.tailwind.css`(`@theme`), 또는 `.design/tokens.daisyui.css`(`@plugin theme`).
   생성 파일은 **한 글자도 수정하지 않는다**.
4. **배선** (연결만):
   - Vite/Next 등: 전역 CSS 최상단에 `@import`로 연결 — 상대 경로는 **그 파일의 실제
     위치 기준으로 계산**할 것 (예: `src/index.css`면 `../.design/tokens.css`).
     (tailwind면 `tokens.tailwind.css` — `@import "tailwindcss";` 다음 줄에)
   - 순수 HTML: `<head>`에 `<link rel="stylesheet" href=".design/tokens.css">`
   - 스타일 진입점이 없으면 하나 만들고 HTML에 연결.
5. 이후 새 코드는 hex/px 하드코딩 대신 변수만 사용: `var(--color-primary)`,
   `var(--radius-base)`, `var(--font-sans)` … (tailwind면 `bg-primary`,
   `text-on-primary`, `rounded-base` 유틸리티가 자동 생성됨).
6. **무손실 검증** (자가 판단 금지, 기계 확인):
   - 1순위: 생성 파일을 복사해두고 스크립트를 같은 인자로 재실행 → `diff`로 **바이트
     동일** 확인 (`git diff`는 `.design/`이 gitignore면 거짓 통과하므로 쓰지 않는다)
   - `color.primary` 값이 생성 파일에 존재하는지 grep — 단 3자리 hex(`#abc`)는
     6자리(`#aabbcc`)로 확장되어 저장되므로 확장값 기준으로 찾는다
7. **커밋하지 않는다** — 변경 파일 목록을 보여주고 커밋은 사용자에게 위임.

## 언제 다시 실행하나
`/studio`에서 "기준 내보내기"로 tokens.json이 갱신될 때마다 3번만 재실행하면
코드 쪽 변수가 통째로 따라온다(배선은 그대로). 기존 코드에 남은 하드코딩 위반은
이 스킬이 아니라 `/design-check` → `/design-apply`로 정리한다.
