/* 팔레트 락 — 순수 색 계산 + (선택) playwright 캔버스 리컬러.
   순수부는 node에서 테스트, 캔버스부는 브라우저 페이지에서 실행. */

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const s = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16));
}

export function nearestPaletteColor(rgb, palette) {
  let best = palette[0], bestD = Infinity;
  for (const p of palette) {
    const d = (p[0] - rgb[0]) ** 2 + (p[1] - rgb[1]) ** 2 + (p[2] - rgb[2]) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

export function gradeStrength(strength) {
  return strength === 'strong' ? 0.85 : strength === 'light' ? 0.4 : 0;
}

/* 브라우저 컨텍스트에서 실행할 리컬러 함수 문자열 생성기.
   page.evaluate에 넘겨 캔버스 픽셀을 팔레트 최근접색과 mix(강도)로 치환. */
export function recolorScript() {
  return `(paletteHex, strength) => {
    const img = document.querySelector('img');
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const pal = paletteHex.map(h => { h = h.replace('#',''); h = h.length===3? h.split('').map(x=>x+x).join(''):h;
      return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)); });
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      let best = pal[0], bd = Infinity;
      for (const p of pal) { const d=(p[0]-px[i])**2+(p[1]-px[i+1])**2+(p[2]-px[i+2])**2; if(d<bd){bd=d;best=p;} }
      px[i]   = Math.round(px[i]   * (1-strength) + best[0] * strength);
      px[i+1] = Math.round(px[i+1] * (1-strength) + best[1] * strength);
      px[i+2] = Math.round(px[i+2] * (1-strength) + best[2] * strength);
    }
    ctx.putImageData(data, 0, 0);
    return c.toDataURL('image/png');
  }`;
}
