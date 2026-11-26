/* 미리보기 시험지를 그대로 그림으로 그려 PDF 파일을 만들어요. */
(function(){
'use strict';
const PW = 794, PH = 1123;                                   // A4 @ 96dpi
const transparent = c => !c || c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c);
function parseShadow(s){
  if (!s || s === 'none') return null;
  const m = s.match(/(rgba?\([^)]*\)|#[0-9a-f]+)\s+(-?[\d.]+)px\s+(-?[\d.]+)px/i);
  return m ? {color: m[1], x: +m[2], y: +m[3]} : null;
}
function loadScript(src){
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
function drawText(g, node, cs, box, F){
  const txt = node.textContent.replace(/\s+/g, ' ').trim();
  if (!txt) return;
  const range = document.createRange(); range.selectNodeContents(node);
  const rects = [...range.getClientRects()].filter(r => r.width > 0);
  if (!rects.length) return;
  const r0 = rects[0], z = box.z;
  const rx = (r0.left - box.left) / z, ry = (r0.top - box.top) / z, rw = rects.reduce((a, r) => a + r.width, 0) / z, rh = r0.height / z;
  const fs = parseFloat(cs.fontSize);
  g.save();
  g.font = `${cs.fontStyle} ${cs.fontWeight} ${fs * F}px ${cs.fontFamily}`;
  g.fillStyle = cs.color; g.textBaseline = 'alphabetic';
  const m = g.measureText(txt);
  const asc = m.fontBoundingBoxAscent ?? fs * F * 0.8, desc = m.fontBoundingBoxDescent ?? fs * F * 0.2;
  const y = ry * F + (rh * F - (asc + desc)) / 2 + asc;
  const ls = parseFloat(cs.letterSpacing) || 0;
  if (Math.abs(ls) > 0.5) {
    let x = rx * F;
    for (const ch of txt) { g.fillText(ch, x, y); x += g.measureText(ch).width + ls * F; }
  } else {
    const sx = m.width > 0 ? (rw * F) / m.width : 1;
    g.translate(rx * F, y); if (Math.abs(sx - 1) > 0.03) g.scale(sx, 1); g.fillText(txt, 0, 0);
  }
  g.restore();
}
async function drawEl(g, el, box, F){
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return;
  if (el.hasAttribute('data-edit') && !el.textContent.trim()) return;  // 비어 있는 부제목 안내 문구는 그리지 않아요
  const a = el.getBoundingClientRect(), z = box.z;
  const x = (a.left - box.left) / z * F, y = (a.top - box.top) / z * F, w = a.width / z * F, h = a.height / z * F;
  const sh = parseShadow(cs.boxShadow);
  const isPage = el.classList.contains('page');
  if (sh && !isPage) { g.fillStyle = sh.color; g.fillRect(x + sh.x * F, y + sh.y * F, w, h); }
  if (!transparent(cs.backgroundColor) && !el.hasAttribute('data-edit')) { g.fillStyle = cs.backgroundColor; g.fillRect(x, y, w, h); }
  if (sh && !isPage && transparent(cs.backgroundColor)) { g.fillStyle = '#fff'; g.fillRect(x, y, w, h); }
  if (el.classList.contains('pbox')) {
    g.save(); g.strokeStyle = '#111'; g.lineWidth = 1.2 * F; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + w, y); g.stroke(); g.restore();
  }
  const bw = s => parseFloat(cs['border' + s + 'Width']) || 0, bs = s => cs['border' + s + 'Style'], bc = s => cs['border' + s + 'Color'];
  const cell = el.tagName === 'TD' || el.tagName === 'TH';
  for (const s of ['Top','Right','Bottom','Left']) {
    const t = bw(s); if (!t || bs(s) === 'none') continue;
    if (cell && s === 'Left' && el.cellIndex > 0) continue;
    if (cell && s === 'Top' && el.parentElement.rowIndex > 0) continue;
    g.fillStyle = bc(s); const tt = t * F;
    if (s === 'Top') g.fillRect(x, y, w, tt); if (s === 'Bottom') g.fillRect(x, y + h - tt, w, tt);
    if (s === 'Left') g.fillRect(x, y, tt, h); if (s === 'Right') g.fillRect(x + w - tt, y, tt, h);
  }
  if (el.tagName === 'IMG') {
    const img = el.complete && el.naturalWidth ? el : await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = el.src; });
    g.imageSmoothingQuality = 'high'; g.drawImage(img, x, y, w, h);
    return;
  }
  for (const n of el.childNodes) {
    if (n.nodeType === 3) drawText(g, n, cs, box, F);
    else if (n.nodeType === 1) {
      if (++drawCount % 30 === 0) await breathe();
      await drawEl(g, n, box, F);
    }
  }
}
let drawCount = 0;
async function renderPage(page, F){
  const pr = page.getBoundingClientRect(), z = pr.width / PW;
  const c = document.createElement('canvas'); c.width = Math.round(PW * F); c.height = Math.round(PH * F);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  await drawEl(g, page, {left: pr.left, top: pr.top, z}, F);
  return c;
}
/* 쪽마다 브라우저에 숨 돌릴 틈을 줘서 화면이 멈추지 않게 해요 */
const breathe = () => new Promise(r => (window.scheduler && scheduler.yield) ? scheduler.yield().then(r) : setTimeout(r, 0));
const F_PDF = 2.2;                                           // 약 210dpi (문항 그림 원본은 200dpi)
window.makePdf = async function(sheet, title, onProgress){
  if (!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  try { await document.fonts.ready; } catch (e) {}
  const pages = [...sheet.querySelectorAll('.page')];
  const doc = new window.jspdf.jsPDF({unit: 'mm', format: 'a4', orientation: 'portrait', compress: true});
  doc.setProperties({title, creator: '수학 기출 문제은행'});
  if (onProgress) onProgress(0, pages.length);
  await breathe();
  for (const [i, page] of pages.entries()) {
    const c = await renderPage(page, F_PDF);
    await breathe();
    // JPEG는 브라우저가 따로 압축하고, PDF에는 다시 풀지 않고 그대로 넣어요 (PNG보다 훨씬 가벼워요)
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    c.width = c.height = 0;                                   // 캔버스 메모리 바로 풀기
    if (i) doc.addPage('a4', 'portrait');
    doc.addImage(bytes, 'JPEG', 0, 0, 210, 297, undefined, 'NONE');
    if (onProgress) onProgress(i + 1, pages.length);
    await breathe();
  }
  return doc.output('blob');
};
})();
