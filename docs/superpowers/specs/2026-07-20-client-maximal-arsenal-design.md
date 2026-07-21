# 클라이언트 맥시멀 아스날 + DaisyUI 포맷 — 설계

- 날짜: 2026-07-20 (구조 개정 2026-07-21)
- 상태: 확정 (구현 진행)
- 관련: design-check(`design-inject`·`tokens-to-code`), design-studio(`studio`·`motion`), visual-studio(`generate`)

## 1. 문제 / 목표

잡스랩 자체 브랜드는 미니멀이지만 **클라이언트는 맥시멀·화려함을 추구할 수 있다**. 클라이언트 작업에 쓸 검증된 외부 리소스를 빠르게 활용하는 전역 역량을 만든다. **단, 자연어→스킬 라우팅에 중복이 생기지 않게** 역할을 엄격히 분리한다.

### 라우팅 원칙 (중복 방지 — 이 설계의 핵심)
| 사용자 의도 | 담당 | 진실 원천 |
|-------------|------|----------|
| "디자인시스템 바꾸기 / 토큰 / primary 정하기" | `studio` + `design-tokens` | **tokens.json (유일)** |
| 포맷 출력(CSS / Tailwind / **DaisyUI**) | `design-inject`(tokens-to-code) | (tokens.json 소비) |
| "화려한 히어로 / 파티클 / 맥시멀 시안 / 외부 컴포넌트" | `arsenal` | (외부 리소스) |

**DaisyUI는 "또 하나의 디자인시스템"이 아니라 tokens.json을 소비하는 하류 출력 포맷**이다. 시스템 정의·변경은 언제나 studio→tokens.json이고, DaisyUI 시안이 필요하면 그 tokens.json에서 테마를 **뽑아** 쓴다. → arsenal과 studio는 경합하지 않는다.

## 2. 비목표
- 잡스랩 자체 사이트 적용(미니멀 유지 — arsenal은 self 감지 시 경고).
- **Origin UI**(21st.dev·자체 DS 중복 + legacy — 사용자 제외 지시).
- 외부 서비스 자동 설치·전면 래핑, 미리보기 UI·자동 fetch(v2).
- DaisyUI를 arsenal의 "변환기"로 넣는 것 — **중복 유발이라 폐기.** design-check 포맷으로 이관.

## 3. 범위 결정 (확정)
| 축 | 결정 |
|----|------|
| DaisyUI 실코드 | **design-check `tokens-to-code`의 세 번째 포맷**(`--format daisyui`). design-check 1.3.0 → 1.4.0 |
| arsenal 배치 | design-studio 새 스킬 `arsenal`(레지스트리+워크플로, **토큰 권한 없음**). design-studio 1.2.0 → 1.3.0 |
| 레지스트리 대상 | casberry(3D 파티클) · OriginKit(모션 컴포넌트+MCP) · 21st Magic(React AI 컴포넌트) · DaisyUI(**design-inject로 뽑아 쓰라는 포인터**) |
| self 정책 | `meta.project == jobslab` 감지 시 **경고**(차단 아님 — 참고 조회 허용) |
| 레지스트리 형식 | JSON(기계 조회 + 사람 열람) |

## 4. 아키텍처

### 4.1 DaisyUI 출력 포맷 (design-check)
`tokens-to-code.mjs`에 `--format daisyui` 추가(기존 `css|tailwind|all`과 동일 패턴). 순수 함수 + 결정적.
- 출력: `<project>/.design/tokens.daisyui.css` — `@plugin "daisyui/theme" { ... }` 블록.
- 매핑(tokens-v1 → DaisyUI 변수, 신뢰 가능한 필드만): `color.primary→--color-primary`, `bg→--color-base-100`, `surface→--color-base-200`, `text→--color-base-content`, `muted→--color-neutral`, `radius.base→--radius-field·--radius-selector`, `radius.card→--radius-box`. 나머지(secondary/accent/semantic)는 DaisyUI 기본 상속(강제 매핑 안 함 — 오배치 방지).
- 함수: `daisyTheme(tokens) → cssString`(별도 lib 또는 tokens-to-code 내부). `all` 포맷에 daisyui 포함.
- design-inject SKILL.md에 포맷 옵션 한 줄 추가.

### 4.2 리소스 레지스트리 (design-studio `skills/arsenal/registry.json`)
큐레이션 JSON. 각 리소스: `{ id, label, forWhat, pull, stackFit, brandNote, maximalTier }`.
- **casberry**: 3D 파티클 히어로. pull=웹 생성기→바닐라 JS 단일 HTML. stackFit=both. brandNote=클라이언트 히어로 전용.
- **originkit**: 리치 모션 컴포넌트. pull=MCP 또는 코드 복사. stackFit=react.
- **21st-magic**: React 컴포넌트 AI 생성. pull=Magic MCP. stackFit=react.
- **daisyui**: 초고속 프로토타이핑. pull=`design-inject --format daisyui`로 클라이언트 테마 생성 + CDN. stackFit=both. brandNote=자체 DS `.btn`과 충돌 → 클라이언트 시안 격리.

### 4.3 arsenal 스킬 (design-studio `skills/arsenal/SKILL.md`)
워크플로: ① self 감지→경고 ② 니즈 수집 ③ registry.json 조회→리소스+pull·brandNote 제시 ④ DaisyUI 경로면 "design-inject --format daisyui로 테마 뽑기" 안내(직접 변환 코드 없음 — 포인터) ⑤ 커밋 금지. **토큰을 정의·변경하지 않는다**(그건 studio/design-tokens 몫).

## 5. 사용자 플로우
니즈 수집 → self 경고(해당 시) → 레지스트리 매칭 → 리소스+사용법 제시 → (DaisyUI면 design-inject로 테마) → 시안.

## 6. v1 vs 이후
- **v1**: DaisyUI 포맷(design-check) + 레지스트리 4종 + arsenal 스킬.
- **v2**: 리소스 자동 fetch/미리보기, casberry export 자동화, MCP 연결 헬퍼.

## 7. 확정된 결정
1. DaisyUI = design-check 출력 포맷(arsenal 변환기 아님) — 중복 제거.
2. 스킬명 `arsenal`, 레지스트리 JSON, self=경고.
3. Origin UI 제외.
