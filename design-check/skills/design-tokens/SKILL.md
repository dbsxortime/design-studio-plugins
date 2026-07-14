---
name: design-tokens
description: 프로젝트 디자인 기준(.design/tokens.json) 확보 — 기존 시스템 토큰화 / 페이지 분석 / 외부 사이트 카피 / 스크린샷 추정 / 업종 온보딩(uipro 데이터 기반 시안+목업) 5경로. 트리거 — "디자인 토큰 만들어", "기준 잡자", "primary 정하자", "/design-tokens".
---

# 기준 토큰 확보 (init)

## 0. 사용자 컨텍스트 우선
프로젝트 CLAUDE.md·디자인 문서(DESIGN.md 등)·사용자 전역 refs에 디자인 규칙이 **있으면**
그 값을 기준 후보로 최우선 반영한다. 없으면 아래 5경로로 진행 (라이트 동작).

## 1. 경로 자동 감지 (순서대로 첫 매치)
- **① 기존 시스템**: tailwind.config.{js,ts}의 theme.colors, CSS :root 변수(--*-color 등),
  기존 토큰 파일(tokens.json, design-tokens.*) 발견 시 → 파싱해 tokens-v1로 변환,
  변환 결과를 표로 보여주고 확인받아 저장.
- **② 페이지 분석**: 토큰 정의는 없지만 코드/실행 중 사이트가 있으면 →
  `node <design-check-root>/scripts/extract-static.mjs <프로젝트>` 실행, 색 빈도 상위·
  radius 최빈값·font-family를 집계해 후보 제시 → 사용자 확정 후 저장.
- **②-b 외부 사이트 카피** (`--from <URL>` 또는 "이 사이트 디자인 카피" 요청):
  playwright MCP로 해당 URL을 열어 ⓐ `:root`의 CSS 변수 덤프
  ⓑ 대표 요소(button, a, h1~h3, input, [class*="card"]) computed style 샘플링 60개
  ⓒ 배경·텍스트 색 빈도 집계 → primary(가장 채도 높은 인터랙션 색)·bg·surface·text·muted,
  font.family(이름만 — 폰트 파일 카피 금지 명시), radius 최빈 스케일, spacing 단위 추정
  → 후보 표로 제시 → 사용자 확정 후 tokens-v1 저장. meta.source: "copied:<host>".
  playwright 부재 시 "외부 카피는 playwright 필요" 안내. 로고·아이콘·일러스트는
  추출 대상이 아님을 항상 명시.
- **②-c 스크린샷 추출** (앱 등 브라우저 접근 불가 대상): 사용자가 화면 캡처 이미지
  2~4장을 주면 Read로 읽어 주요 색(배경·서피스·텍스트·인터랙션 색)·radius 스케일·
  간격 단위·타이포 성향을 **추정**해 tokens-v1 후보 제시. meta.source: "screenshot".
  반드시 "추정치이므로 /studio에서 다듬기"를 안내 — 정확도가 실측보다 낮음을 명시.
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

## 2. 저장 형식 (tokens-v1)
`.design/tokens.json` — $schema "design-studio/tokens-v1",
meta{project,updated,source}, color{primary,onPrimary,bg,surface,text,muted,allowed[]},
font{family,headingWeight,bodySize}, radius{base,card,pill},
spacing{unit,gutter}, tolerance{colorDeltaE:5,radiusPx:2}

⚠️ **onPrimary(대비색) 자동 규칙**: primary 위에 올라가는 텍스트/아이콘 색.
사용자가 지정하지 않으면 반드시 lib/tokens.mjs의 `contrastOn(primary)`로 계산해 채운다
(WCAG 상대 휘도 — 어두운 primary→#FFFFFF, 밝은 primary→#111111).
primary를 바꾸면 onPrimary도 재계산해 함께 갱신할 것.

## 3. 마무리
"시각적으로 다듬으려면 /studio를 실행하세요 — 조합기에서 15종 시스템과 믹스하고
'기준 내보내기'로 이 파일이 갱신됩니다"라고 안내.
신규 프로젝트(온보딩 경로)면 이어서 `/design-inject`로 기준을 코드에 심을 수 있음을
함께 안내한다 — 값 손타이핑 없이 변환 스크립트가 CSS 변수/Tailwind 테마를 생성.
