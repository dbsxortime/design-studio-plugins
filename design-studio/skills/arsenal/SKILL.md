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
