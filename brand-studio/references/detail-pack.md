# 디테일 팩

> 이 문서는 /brand 미팅 5(디테일)를 진행하는 AI가 읽고 실행한다. 로고·색·타이포가 브랜드의 '겉'이라면, 디테일 팩은 '손끝'이다 — 선택 하이라이트 색, 포커스 링, 스피너, 눌림감. 사용자는 이걸 의식하지 못하지만, 없으면 '덜 만들어진 제품'으로 느낀다.

**CSS 정본 계약**: 아래 각 항목의 생성 CSS는 `brand-studio/scripts/lib/brand.mjs`의 `deriveDetailsCss()` 출력과 **1:1로 일치**한다. 이 문서에서 CSS를 새로 짓지 마라 — 함수가 정본이고, 이 문서는 그 출력을 인용할 뿐이다. `{color.primary}` 같은 중괄호 표기는 빌드 시 tokens 값으로 치환되는 자리다(색은 반드시 tokens에서만 나온다 — 하드코딩 금지). 항목 활성/비활성은 brand.json `assets.details[].enabled`로 제어하며, 명시 없으면 기본 활성이다.

디테일 팩은 9항목이다: 마커 CSS 7종(selection·focus-ring·scrollbar·spinner·skeleton·fade-in·press) + reduced-motion 폴백 + 로고 모션 프리셋 4종.

---

## 1. detail:selection — 텍스트 선택 색

- **무엇/왜**: 드래그로 텍스트를 선택했을 때의 하이라이트 색. 왜 — 기본 파란색을 그대로 두면 브랜드 화면에 OS 색이 침범해 완성도가 깨진다.
- **파생 규칙**: 배경 = `color.primary`, 글자 = `color.onPrimary`(primary 위 가독색).

```css
/* detail:selection */
::selection { background: {color.primary}; color: {color.onPrimary}; }
```

## 2. detail:focus-ring — 포커스 링

- **무엇/왜**: 키보드로 이동할 때 현재 요소를 감싸는 테두리. 왜 — 키보드·스크린리더 사용자의 유일한 위치 신호다. 없으면 접근성이 무너진다.
- **파생 규칙**: 색 = `color.primary`, 두께 2px, 오프셋 2px(요소에서 살짝 띄워 형태를 가리지 않게).

```css
/* detail:focus-ring */
:focus-visible { outline: 2px solid {color.primary}; outline-offset: 2px; }
```

## 3. detail:scrollbar — 스크롤바

- **무엇/왜**: 웹킷 브라우저의 스크롤바 스타일. 왜 — 기본 회색 스크롤바는 브랜드 색과 따로 논다.
- **파생 규칙**: 폭 = `spacing.unit`, 트랙 = `color.bg`, 썸 = `color.muted` + `radius.pill`.

```css
/* detail:scrollbar */
::-webkit-scrollbar { width: {spacing.unit}; }
::-webkit-scrollbar-track { background: {color.bg}; }
::-webkit-scrollbar-thumb { background: {color.muted}; border-radius: {radius.pill}; }
```

## 4. detail:spinner — 로딩 스피너

- **무엇/왜**: 데이터 대기 중 회전 인디케이터. 왜 — 로딩 순간에도 브랜드 색이 이어져야 '기다림'조차 브랜드 경험이 된다.
- **파생 규칙**: 24×24, 테두리 3px = `color.surface`, 상단만 `color.primary`, 0.8s 등속 무한 회전. 획 굵기(3px)는 로고 획 비율과 연동한다.

```css
/* detail:spinner */
.ds-spinner { width: 24px; height: 24px; border: 3px solid {color.surface}; border-top-color: {color.primary}; border-radius: 50%; animation: ds-spin .8s linear infinite; }
@keyframes ds-spin { to { transform: rotate(360deg); } }
```

## 5. detail:skeleton — 스켈레톤

- **무엇/왜**: 콘텐츠 로딩 전 자리 표시자의 흐르는 명암. 왜 — 빈 화면보다 골격을 먼저 보여주면 체감 대기가 짧아진다.
- **파생 규칙**: `color.surface`→`color.bg`→`color.surface` 그러데이션, 1.5s ease 무한, 모서리 `radius.base`.

```css
/* detail:skeleton */
.ds-skeleton { background: linear-gradient(90deg, {color.surface} 25%, {color.bg} 50%, {color.surface} 75%); background-size: 200% 100%; animation: ds-skeleton 1.5s ease infinite; border-radius: {radius.base}; }
@keyframes ds-skeleton { to { background-position: -200% 0; } }
```

## 6. detail:fade-in — 페이드 인

- **무엇/왜**: 요소 등장 시 살짝 떠오르며 나타나는 진입 모션. 왜 — 콘텐츠가 툭 튀어나오면 거칠고, 짧은 페이드가 부드러움을 준다.
- **파생 규칙**: 0.3s ease, 4px 아래에서 위로 + 투명도 0→1.

```css
/* detail:fade-in */
.ds-fade-in { animation: ds-fade-in .3s ease both; }
@keyframes ds-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
```

## 7. detail:press — 눌림감

- **무엇/왜**: 버튼을 누를 때 살짝 작아지는 반응. 왜 — 촉각 없는 화면에서 '눌렸다'는 물리 피드백을 대신한다.
- **파생 규칙**: 0.1s 전환, active 시 scale 0.97.

```css
/* detail:press */
.ds-press { transition: transform .1s ease; }
.ds-press:active { transform: scale(0.97); }
```

## 8. reduced-motion 폴백

- **무엇/왜**: 사용자가 OS에서 '모션 줄이기'를 켜면 모든 반복·전환 애니메이션을 끈다. 왜 — 전정기관이 예민한 사용자에게 움직임은 어지럼·메스꺼움을 유발한다. 이건 취향이 아니라 접근성 의무다.
- **파생 규칙**: 애니메이션이 있는 항목(spinner·skeleton·fade-in)은 `animation: none`, press는 `transition: none`. 활성화된 항목만 선택자에 포함된다.

```css
@media (prefers-reduced-motion: reduce) {
  .ds-spinner, .ds-skeleton, .ds-fade-in { animation: none; }
  .ds-press { transition: none; }
}
```

## 9. 로고 모션 프리셋 4종

로고를 스플래시·헤더 등장·로딩에 쓸 때의 진입 모션. **CSS만 제공**하며, 아래 공통 규율을 전부 지킨다. 이 프리셋은 detail-pack의 정본으로, 지속시간은 **0.8~1.5s** 범위 안, 표준 이징(ease-in-out 계열)을 쓰고, **reduced-motion 폴백을 필수**로 붙인다.

```css
/* draw — 획 그리기 (심볼·라인 로고용, stroke-dasharray로 선을 그어 나감) */
.logo-draw path { stroke-dasharray: 1; stroke-dashoffset: 1; animation: logo-draw 1.2s ease-in-out forwards; }
@keyframes logo-draw { to { stroke-dashoffset: 0; } }

/* fade — 페이드 (모든 로고 공용, 아래에서 위로 떠오름) */
.logo-fade { animation: logo-fade 0.8s ease-in-out both; }
@keyframes logo-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* spin — 회전 (원형·방사형 심볼용, 1회 등장 회전) */
.logo-spin { animation: logo-spin 1s ease-in-out both; }
@keyframes logo-spin { from { opacity: 0; transform: rotate(-90deg) scale(0.8); } to { opacity: 1; transform: rotate(0) scale(1); } }

/* pulse — 맥동 (로딩 대기용, 은은한 확대/축소 반복) */
.logo-pulse { animation: logo-pulse 1.5s ease-in-out infinite; }
@keyframes logo-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.04); opacity: 0.85; } }

@media (prefers-reduced-motion: reduce) {
  .logo-draw path, .logo-fade, .logo-spin, .logo-pulse { animation: none; }
  .logo-draw path { stroke-dashoffset: 0; }
}
```

---

## 접근성·모션 크래프트 규칙

디테일과 모션을 만들 때 반드시 준수하는 접근성 규율. 각 규칙의 왜를 사용자에게 그대로 인용하라.

1. **포커스 링 대비 ≥ 3:1, 두께 ≥ 2px**: 포커스 링과 인접 배경의 명도 대비를 3:1 이상, 두께를 2px 이상으로 잡는다(WCAG 기준). 왜 — 키보드 사용자에게 포커스 링은 유일한 현위치 표시다. 흐리거나 얇으면 어디 있는지 못 찾아 조작 불능이 된다.

2. **선택색 위 텍스트 가독 유지**: 선택 하이라이트(`::selection`) 배경 위 글자색(`color.onPrimary`)이 읽히는지 확인한다. 왜 — 선택 순간 글자가 배경에 묻히면 복사·편집 중 내용이 안 보인다.

3. **스피너 획 굵기 = 로고 획 비율 연동**: 스피너 테두리 굵기를 로고 스트로크 비율에 맞춘다. 왜 — 로딩 인디케이터까지 로고와 같은 굵기여야 브랜드 일관성이 손끝까지 이어진다.

4. **로딩 루프 지속시간 0.8~1.5s·표준 이징**: 반복 로딩 모션의 한 주기를 0.8~1.5s로, 이징은 ease-in-out 계열로 잡는다. 왜 — 이보다 빠르면 초조하고 느리면 멈춘 듯 보인다. 이 구간이 '진행 중'을 자연스럽게 전달한다.

5. **초당 3회 이상 점멸 절대 금지**: 어떤 요소도 1초에 3번 이상 깜빡이게 만들지 마라. 왜 — 광과민성 발작(광과민성 간질)을 유발할 수 있다. 이건 미학 문제가 아니라 사용자의 안전 문제이며, 타협 대상이 아니다.
