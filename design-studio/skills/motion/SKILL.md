---
name: motion
description: 모션 갤러리(애니메이션 142종) 조회·코드 추출·사용 이력 기록. 트리거 — "애니메이션 추천/찾아", "모션 갤러리", "이 효과 코드", "/motion". 프로젝트에 애니메이션을 적용할 때 반드시 이 갤러리를 먼저 검색.
---

# Motion Lab CLI

CLI: `node <plugin-root>/scripts/motion-lab.mjs` (plugin-root = 이 스킬 기준 `../..`)

- 목록: `motion-lab list [--cat text|comp|sect|page|bg|eng] [--proj 이름]`
- 검색: `motion-lab search <키워드>`
- 코드 추출: `motion-lab get <id>` — React 코드·의존성·원본 링크 출력
- 시각 확인이 필요하면 /studio로 스튜디오를 열어 모션 랩 탭에서 데모 재생

## 사용 이력 기록 (필수 규칙)

갤러리의 애니메이션을 프로젝트에 실제 적용했다면 **반드시** 기록한다:
`motion-lab add-use <id> --p <프로젝트명> --where <파일/섹션> --how <어떻게 사용했는지 한 줄>`
- 프로젝트명 표기는 일관되게 (스튜디오 필터에 노출됨)
- 같은 패턴을 변형 적용한 경우에도 기록하고 how에 변형 내용을 적는다

## 런타임 엔진 — Motion (motion.dev)

갤러리 코드 상당수가 React(Framer Motion) 전제다. **정적 HTML/바닐라 JS 프로젝트**(빌드 도구 없는 사이트)에는 Motion을 바닐라로 얹는다 — 같은 엔진, 프레임워크 무관.

- **도입(빌드 불필요, 버전 고정)**: `<script type="module">import { animate, inView, stagger } from "https://cdn.jsdelivr.net/npm/motion@11/+esm"</script>`. 단순 등장만이면 미니 2.3kb: `motion@11/mini/+esm`. 프로덕션은 `@11.x.x`로 핀.
- **핵심 API**: `animate()`(코어) · `inView()`(스크롤 등장) · `stagger()`(순차) · `scroll()`(스크롤 연동, ScrollTimeline) · gesture/spring. React면 갤러리 코드 그대로, 바닐라면 위 함수형.
- **MIT 무료** — 라이선스 리스크 없음(GSAP 유료 플러그인 이슈 회피).

## 브랜드 이징 규율 (적용 시 필수)

라이브러리 기본값을 그대로 쓰지 말고 **프로젝트 모션 토큰으로 번역**한다:

- **이징/지속시간은 프로젝트 토큰 우선** — `.design/tokens.json §motion`이 있으면 `/design-inject`가 생성한 `--ease-standard`·`--ease-exit`·`--dur-fast/base/slow`를 쓴다. JS에선 `getComputedStyle(document.documentElement).getPropertyValue('--ease-standard')`로 읽어 `animate(el, {...}, { easing })`에 전달.
- **bounce·elastic·overshoot 금지** — 스프링 기본값의 통통 튐은 절제 톤을 깬다. 꼭 스프링이면 `bounce: 0`.
- **`prefers-reduced-motion` 필수** — 등장물은 초기 상태를 CSS로 숨기고(진입 시 드러냄, FOUC 방지), reduce 시 최종 상태로 즉시 표시.
- **`transform`/`opacity`만** 애니메이션(레이아웃 속성 금지 — GPU 가속).
- 프로젝트에 이미 정교한 자체 모션 시스템이 있으면 **덮어쓰지 말 것** — 중복·충돌 확인 후 필요한 곳에만.
