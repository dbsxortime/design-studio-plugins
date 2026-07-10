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
