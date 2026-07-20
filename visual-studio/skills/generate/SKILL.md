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
