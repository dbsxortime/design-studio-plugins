---
name: design-apply
description: 점검 리포트의 위반을 확정 토큰 값으로 일괄 수정. 트리거 — "위반 고쳐", "토큰대로 적용", "전체 수정", "/design-apply". 반드시 /design-check 이후.
---

# 일괄 적용 (승인 게이트 — 순서 고정, 생략 금지)

1. **git 작업트리 클린 확인**: `git status --porcelain`이 비어있지 않으면 **중단**하고
   "커밋/스태시 후 재실행"을 안내한다.
2. `.design/check-report.json` 없거나 오래됐으면 /design-check 먼저 재실행.
3. `node <design-check-root>/scripts/apply-map.mjs <프로젝트>` 실행 →
   **변경 계획을 표로 제시** (파일 · 건수 · 대표 변경 예 from→to) + skipped 목록.
4. **사용자 승인을 받은 후에만** 적용 시작. 파일별로 Edit 도구로 치환하되:
   - 같은 줄의 from 값이 계획과 다르면(코드가 그새 바뀜) 그 건은 스킵하고 기록
   - 동일 값이 한 줄에 여러 번이면 replace_all이 아니라 해당 속성만 정확히 치환
   - **font 치환 주의**: from이 따옴표 안 값이면 부분 치환 시 따옴표가 중첩돼 CSS가 깨진다
     (`'Comic Sans MS'` → `''Pretendard', sans-serif'`). font-family는 **선언의 값 전체
     (따옴표 포함)를 교체**할 것: `font-family: 'Comic Sans MS';` → `font-family: 'Pretendard', sans-serif;`
5. 적용 완료 후 `/design-check` 재실행 → **위반 0 수렴 확인**.
   수렴 안 하면 잔여 위반 + skipped를 표로 보고 (수동 확인 대상).
6. **커밋하지 않는다** — `git diff --stat` 요약을 보여주고 커밋은 사용자에게 위임.
