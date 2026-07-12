# design-studio-plugins

프로젝트 디자인 기준(`.design/tokens.json`)을 잡고, 로컬 스튜디오로 다듬고,
사이트/코드가 그 기준을 지키는지 점검·수정하는 Claude Code 플러그인 묶음.

**설치 없이 둘러보기**: 스튜디오 웹 버전 → https://design.jobslab.dev

## 설치

```
claude plugin marketplace add dbsxortime/design-studio-plugins
claude plugin install design-check@design-studio-plugins
```

`design-check`는 `design-studio`(같은 마켓플레이스)와 `playwright`(공식 마켓플레이스)에
의존한다 — 위 두 줄만 실행하면 두 의존성이 자동 설치된다.

**브랜드(로고·아이콘·브랜드북)가 목적이면 이 한 줄이면 충분하다** —
`claude plugin install brand-studio@design-studio-plugins`
(design-check·design-studio·playwright가 전부 자동 설치됨)

**전제조건**: Claude Code 최신 버전, Node 18+

## 어디서부터?

- **신규 프로젝트**: `/design-tokens`(온보딩 3~4질문) → `/studio`(시각 다듬기) →
  `/brand`(브랜드 미팅) → `/design-inject`(코드로 심기)
- **기존 프로젝트**: `/design-tokens`(코드에서 기준 추출) → `/design-check`(점검) →
  `/design-apply`(승인 후 일괄 수정)

## 스킬 7종

| 스킬 | 플러그인 | 역할 |
|---|---|---|
| `/studio` | design-studio | 로컬 스튜디오(`:28572`)를 열어 토큰 조합기·모션 랩 142카드를 시각 편집 |
| `/motion` | design-studio | 모션 갤러리 조회·검색·코드 추출, 적용 시 사용 이력 기록 |
| `/design-tokens` | design-check | 기준 토큰(`.design/tokens.json`) 확보 — 기존 시스템 변환 / 페이지 실측 / 외부 사이트 카피 / 스크린샷 추정 / 채팅 온보딩 |
| `/design-inject` | design-check | 확정 기준을 CSS 변수/Tailwind `@theme`로 **생성해** 프로젝트에 심기 — 값 손타이핑 금지(`tokens-to-code.mjs`가 결정적 생성, 에이전트는 배선만) |
| `/design-check` | design-check | 기준 대비 정적 점검(코드) + 실측 점검(playwright, URL 있을 때) |
| `/design-apply` | design-check | 점검 리포트의 위반을 승인 게이트 거쳐 일괄 수정 (`/design-check` 이후에만) |
| `/brand` | brand-studio | 브랜드 미팅 딸깍 — 로고 시스템·아이콘·그래픽 언어·OG/소셜·마감 디테일·브랜드북을 15년차 디자이너 미팅 UX로 생성·배선. **대화형 미팅**이며 아이콘·OG 이미지는 playwright 브라우저 캡처를 거쳐 만들어진다 |

## tokens-v1 스키마

`.design/tokens.json`:

```json
{
  "$schema": "design-studio/tokens-v1",
  "meta": { "project": "string", "updated": "YYYY-MM-DD", "source": "onboarding|extracted|copied:<host>|screenshot" },
  "color": {
    "primary": "#hex",
    "onPrimary": "#hex",
    "bg": "#hex", "surface": "#hex", "text": "#hex", "muted": "#hex",
    "allowed": ["#hex", "..."]
  },
  "font": { "family": "string", "headingWeight": 800, "bodySize": "14px" },
  "radius": { "base": "10px", "card": "14px", "pill": "999px" },
  "spacing": { "unit": "4px", "gutter": "16px" },
  "tolerance": { "colorDeltaE": 5, "radiusPx": 2 }
}
```

**`color.onPrimary` 자동 대비 규칙**: primary 위에 올라가는 텍스트/아이콘 색이다.
사용자가 직접 지정하지 않으면 WCAG 상대 휘도 기준(큰 텍스트 3:1)으로 자동 계산된다 —
`design-check/scripts/lib/tokens.mjs`의 `contrastOn(primary)`: 대비율이 3:1 이상이면
`#FFFFFF`, 아니면 `#111111`. `primary`를 바꾸면 `onPrimary`도 함께 재계산해서 갱신해야 한다.

## 기준 확보 경로

`/design-tokens`는 5가지 경로로 기준을 채운다 (순서대로 첫 매치, 또는 명시 요청):

- 기존 시스템(tailwind config, CSS 변수, 기존 토큰 파일) 파싱
- 페이지 정적 분석(`extract-static.mjs`) — 색 빈도·radius 최빈값·font-family 집계
- **외부 사이트 카피** (`--from <URL>`, playwright 필요) — `:root` CSS 변수 + 대표 요소 60개 샘플링으로 색·폰트·radius·spacing 후보 추출. 로고·아이콘·일러스트는 추출 대상 아님
- **스크린샷 추출** (앱 등 브라우저 접근 불가 대상) — 캡처 이미지 2~4장을 읽어 색·radius·간격·타이포를 추정(정확도는 실측보다 낮음, `/studio`에서 다듬기 권장)
- 채팅 온보딩(3~4개 질문) — 신규 프로젝트용

## 의존성 구조

```
design-check  ──depends on──▶  design-studio        (같은 마켓플레이스: design-studio-plugins)
              ──depends on──▶  playwright            (교차 마켓플레이스: claude-plugins-official)

brand-studio  ──depends on──▶  design-check          (같은 마켓플레이스: design-studio-plugins)
              ──depends on──▶  design-studio         (같은 마켓플레이스: design-studio-plugins)
              ──depends on──▶  playwright            (교차 마켓플레이스: claude-plugins-official)
```

`design-check`의 실측 점검(`/design-check [url]`)과 외부 사이트 카피(`--from`)는
playwright MCP 도구가 세션에 있을 때만 동작한다. 없으면 에러가 아니라
"실측 생략됨(playwright 미설치)"으로 정적 점검만 보고한다.

## 로컬 스튜디오

`/studio`는 고정 포트 **`:28572`**에서 뜬다. 이미 떠 있으면 재사용(브라우저만 오픈),
다른 프로세스가 점유 중이면 명확한 에러를 낸다. 30분 유휴 시 자동 종료.

## 테스트

```bash
node --test                # 전체 스위트 (tests/ 하위 *.test.mjs 재귀 탐색, 인자 없이 실행)
tests/e2e-p1.sh             # design-studio: serve + CLI 왕복
tests/e2e-p2.sh             # design-check: 정적 점검 클린 픽스처
```

`node --test`와 `tests/e2e-*.sh` 모두 `:28572`가 비어 있어야 통과한다 —
`/studio`로 띄운 스튜디오가 남아 있으면 먼저 종료할 것.
