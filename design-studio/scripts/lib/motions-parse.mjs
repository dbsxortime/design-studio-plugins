// MOTIONS 배열 리터럴을 추출해 평가한다.
// 전제(스튜디오 파일 보장 사항): 배열은 `const MOTIONS=[` 로 시작해 줄 시작의 `];` 로 닫히고,
// 내부 템플릿 리터럴은 외부 변수를 참조하지 않는 자기완결 표현식이다.
export function parseMotions(html) {
  const start = html.indexOf('const MOTIONS=[');
  if (start < 0) throw new Error('MOTIONS not found — studio.html 구조 변경?');
  const end = html.indexOf('\n];', start);
  if (end < 0) throw new Error('MOTIONS terminator not found');
  const body = html.slice(start + 'const MOTIONS='.length, end + 3);
  const arr = new Function(`"use strict"; return ${body.slice(0, -1)}`)(); // 끝 ';' 제거
  return arr.map(m => ({
    id: m.id, cat: m.cat, title: m.title, lib: m.lib, lic: m.lic,
    stack: m.stack || [], note: m.note || '', deps: m.deps || '',
    links: m.links || [], code: m.code || '', uses: m.uses || [],
  }));
}
