---
name: design-check
description: 사이트/코드가 .design/tokens.json 기준을 지키는지 점검(색·radius·폰트). 트리거 — "디자인 점검", "기준 지키는지 확인", "컬러 감사", "/design-check [url]".
---

# 기준 준수 점검

전제: `.design/tokens.json` 필요. 없으면 /design-tokens init 먼저 안내.

## 1. 정적 점검 (항상)
`node <design-check-root>/scripts/check-report.mjs <프로젝트>`
→ `.design/check-report.{json,md}` 생성, md를 사용자에게 요약 보고.

## 2. 실측 점검 (URL이 주어졌고 playwright MCP 도구가 세션에 있으면)
1. browser_navigate로 URL 열기
2. browser_evaluate로 대표 요소 샘플링:
   `[...document.querySelectorAll('button, a.btn, [class*="btn"], h1, h2, [class*="card"]')]
     .slice(0, 60).map(el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect();
     return r.width > 0 && { selector: el.tagName + '.' + [...el.classList].join('.'),
       findings: [
         { kind: 'color', value: s.backgroundColor },
         { kind: 'color', value: s.color },
         { kind: 'radius', value: s.borderRadius },
         { kind: 'font', value: s.fontFamily } ] }; }).filter(Boolean)`
3. 결과를 `{findings:[{kind,value,selector,file:null,line:0}]}` 형태로
   `.design/live-findings.json`에 저장 (rgba(0,0,0,0)·투명 배경은 제외).
   ⚠️ evaluate 결과는 요소별 중첩 구조이므로 **반드시 평탄화**해서 저장:
   `{findings: results.flatMap(r => r.findings.map(f => ({...f, selector: r.selector, file: null, line: 0})))}`
4. `node check-report.mjs <프로젝트> --live .design/live-findings.json`
- playwright가 없으면: 정적 리포트에 "실측 생략됨(playwright 미설치)" 명시. 에러 아님.

## 3. 보고
심각도별 위반 수 + 대표 사례 5개 + "수정 적용은 /design-apply" 안내.
위반 0이면 축하하고 종료.
