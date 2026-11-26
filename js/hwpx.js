/* 한글(HWPX) 시험지 만들기
   미리보기에 그려진 시험지를 그대로 옮겨요. 머리글(제목 · 부제목) · 문항 · 바닥글 ·
   단 구분선 · 문항 정보표를 미리보기와 같은 자리에 고정된 그림으로 넣어요. 기본 틀(hwpx/)은 python-hwpx(Apache-2.0)의 빈 문서를 바탕으로 했어요. */
(function(){
'use strict';
const PW = 794, PH = 1123;                                   // A4 @ 96dpi
const U = px => Math.max(1, Math.round(px * 75));            // 화소 → HWPUNIT(1/7200 inch)
const X = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const TPL_FILES = ['mimetype','version.xml','settings.xml','META-INF/container.xml','META-INF/container.rdf','META-INF/manifest.xml',
  'Contents/header.xml','Contents/content.hpf','Contents/section0.xml','Preview/PrvImage.png'];
let tplCache = null;
async function loadTemplate(){
  if (tplCache) return tplCache;
  const out = {};
  await Promise.all(TPL_FILES.map(async f => {
    const r = await fetch('hwpx/' + f, {cache: 'force-cache'});
    if (!r.ok) throw new Error('template ' + f);
    out[f] = f.endsWith('.png') ? await r.arrayBuffer() : await r.text();
  }));
  return tplCache = out;
}
function loadScript(src){
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
let seq = 0;
const nid = () => String(1200000000 + (++seq) * 7919 % 800000000 + Math.floor(Math.random() * 997));

/* ================= 미리보기 → 그림 ================= */
const transparent = c => !c || c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c);
function parseShadow(s){
  if (!s || s === 'none') return null;
  const m = s.match(/(rgba?\([^)]*\)|#[0-9a-f]+)\s+(-?[\d.]+)px\s+(-?[\d.]+)px/i);
  return m ? {color: m[1], x: +m[2], y: +m[3]} : null;
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
  if (Math.abs(ls) > 0.5) {                                   // 자간이 넓은 글자(예: 5 지 선 다 형)
    let x = rx * F;
    for (const ch of txt) { g.fillText(ch, x, y); x += g.measureText(ch).width + ls * F; }
  } else {
    const sx = m.width > 0 ? (rw * F) / m.width : 1;          // 가로로 줄인 문항 번호 등도 같은 폭으로
    g.translate(rx * F, y); if (Math.abs(sx - 1) > 0.03) g.scale(sx, 1); g.fillText(txt, 0, 0);
  }
  g.restore();
}
async function drawEl(g, el, box, F, opt){
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return;
  if (opt.skip && opt.skip(el)) return;
  const a = el.getBoundingClientRect(), z = box.z;
  const x = (a.left - box.left) / z * F, y = (a.top - box.top) / z * F, w = a.width / z * F, h = a.height / z * F;
  const sh = parseShadow(cs.boxShadow);
  if (sh && !opt.noShadow) { g.fillStyle = sh.color; g.fillRect(x + sh.x * F, y + sh.y * F, w, h); }
  if (!transparent(cs.backgroundColor)) { g.fillStyle = cs.backgroundColor; g.fillRect(x, y, w, h); }
  if (sh && !opt.noShadow && transparent(cs.backgroundColor)) { g.fillStyle = '#fff'; g.fillRect(x, y, w, h); }
  if (el.classList.contains('pbox')) {                        // 쪽 번호 상자의 사선
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
  if (opt.bordersOnly) return;
  if (el.tagName === 'IMG') {
    const img = el.complete && el.naturalWidth ? el : await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = el.src; });
    g.imageSmoothingQuality = 'high'; g.drawImage(img, x, y, w, h);
    return;
  }
  for (const n of el.childNodes) {
    if (n.nodeType === 3) drawText(g, n, cs, box, F);
    else if (n.nodeType === 1) await drawEl(g, n, box, F, opt);
  }
}
/* 요소(들)를 그림 한 장으로. 반환: {png, x, y, w, h} (쪽 기준 화소) */
async function snap(page, els, F, opt = {}){
  els = [].concat(els).filter(Boolean);
  const pr = page.getBoundingClientRect(), z = pr.width / PW;
  let L = Infinity, T = Infinity, R = -Infinity, B = -Infinity;
  for (const el of els) {
    const r = el.getBoundingClientRect(), sh = parseShadow(getComputedStyle(el).boxShadow);
    L = Math.min(L, r.left); T = Math.min(T, r.top);
    R = Math.max(R, r.right + (sh ? Math.max(0, sh.x) * z : 0)); B = Math.max(B, r.bottom + (sh ? Math.max(0, sh.y) * z : 0));
    for (const d of el.querySelectorAll('*')) { const q = d.getBoundingClientRect(); if (q.width && q.height) { R = Math.max(R, q.right + 3 * z); B = Math.max(B, q.bottom + 3 * z); } }
  }
  const pad = 1;
  const box = {left: L - pad * z, top: T - pad * z, z};
  const wpx = (R - L) / z + pad * 2, hpx = (B - T) / z + pad * 2;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(wpx * F)); c.height = Math.max(1, Math.ceil(hpx * F));
  const g = c.getContext('2d');
  if (!opt.alpha) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
  for (const el of els) await drawEl(g, el, box, F, opt);
  const png = await (await new Promise(r => c.toBlob(r, 'image/png'))).arrayBuffer();
  return {png, x: (box.left - pr.left) / z, y: (box.top - pr.top) / z, w: wpx, h: hpx};
}
async function solid(x, y, w, h, color){
  const c = document.createElement('canvas'); c.width = 2; c.height = 2;
  const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 2, 2);
  return {png: await (await new Promise(r => c.toBlob(r, 'image/png'))).arrayBuffer(), x, y, w, h};
}

/* ================= header.xml ================= */
const binId = i => 'BIN' + String(i + 1).padStart(4, '0');
const binName = i => binId(i) + '.png';
function patchHeader(h, binCount, textStyles){
  const cp0 = h.match(/<hh:charPr id="0"[\s\S]*?<\/hh:charPr>/)[0];
  const pp0 = h.match(/<hh:paraPr id="0"[\s\S]*?<\/hh:paraPr>/)[0];
  const nCP = +h.match(/<hh:charProperties itemCnt="(\d+)"/)[1];
  const nPP = +h.match(/<hh:paraProperties itemCnt="(\d+)"/)[1];
  const cps = [], pps = [], ids = {};
  textStyles.forEach((t, i) => {
    const cid = nCP + i, pid = nPP + i; ids[t.key] = {cp: cid, pp: pid};
    let c = cp0.replace('id="0"', `id="${cid}"`).replace('height="1000"', `height="${Math.round(t.pt * 100)}"`)
      .replace(/textColor="[^"]*"/, `textColor="${t.color || '#000000'}"`)
      .replace(/<hh:fontRef[^>]*\/>/, '<hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>');
    if (t.bold) c = c.replace('<hh:underline', '<hh:bold/><hh:underline');
    cps.push(c);
    pps.push(pp0.replace('id="0"', `id="${pid}"`).replace('horizontal="JUSTIFY"', `horizontal="${t.align}"`)
      .replace(/<hh:lineSpacing type="PERCENT" value="160"/g, '<hh:lineSpacing type="PERCENT" value="100"')
      .replace(/<hc:prev value="0" unit="HWPUNIT"\/>/g, `<hc:prev value="${t.prev || 0}" unit="HWPUNIT"/>`)
      .replace('snapToGrid="1"', 'snapToGrid="0"'));
  });
  let bins = '';
  for (let i = 0; i < binCount; i++) bins += `<hh:binItem id="${i}" Type="Embedding" BinData="${binName(i)}" Format="png"/>`;
  h = h.replace(/<hh:charProperties itemCnt="\d+">/, `<hh:charProperties itemCnt="${nCP + cps.length}">`).replace('</hh:charProperties>', cps.join('') + '</hh:charProperties>')
       .replace(/<hh:paraProperties itemCnt="\d+">/, `<hh:paraProperties itemCnt="${nPP + pps.length}">`).replace('</hh:paraProperties>', pps.join('') + '</hh:paraProperties>');
  if (binCount) h = h.replace('</hh:refList>', `<hh:binDataList itemCnt="${binCount}">${bins}</hh:binDataList></hh:refList>`);
  return {header: h, ids};
}

/* ================= section0.xml ================= */
const para = (inner, {pp = 0, pageBreak = 0} = {}) =>
  `<hp:p id="${nid()}" paraPrIDRef="${pp}" styleIDRef="0" pageBreak="${pageBreak}" columnBreak="0" merged="0">${inner}</hp:p>`;
const run = (cp, inner) => `<hp:run charPrIDRef="${cp}">${inner}</hp:run>`;
function floatPic(bin, f, z){
  const i = nid(), w = U(f.w), h = U(f.h), x = U(f.x), y = U(f.y);
  return run(0, `<hp:pic id="${i}" zOrder="${z}" numberingType="PICTURE" textWrap="IN_FRONT_OF_TEXT" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${i}" reverse="0">`
    + `<hp:offset x="0" y="0"/><hp:orgSz width="${w}" height="${h}"/><hp:curSz width="${w}" height="${h}"/><hp:flip horizontal="0" vertical="0"/>`
    + `<hp:rotationInfo angle="0" centerX="${w >> 1}" centerY="${h >> 1}" rotateimage="1"/>`
    + `<hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo>`
    + `<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="${w}" y="0"/><hc:pt2 x="${w}" y="${h}"/><hc:pt3 x="0" y="${h}"/></hp:imgRect>`
    + `<hp:imgClip left="0" right="${w}" top="0" bottom="${h}"/><hp:inMargin left="0" right="0" top="0" bottom="0"/><hp:imgDim dimwidth="${w}" dimheight="${h}"/>`
    + `<hc:img binaryItemIDRef="${bin}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/><hp:effects/>`
    + `<hp:sz width="${w}" widthRelTo="ABSOLUTE" height="${h}" heightRelTo="ABSOLUTE" protect="0"/>`
    + `<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="0" allowOverlap="1" holdAnchorAndSO="0" vertRelTo="PAPER" horzRelTo="PAPER" vertAlign="TOP" horzAlign="LEFT" vertOffset="${y}" horzOffset="${x}"/>`
    + `<hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:shapeComment/></hp:pic>`);
}

/* ================= 만들기 ================= */
window.makeHwpx = async function(ctx){
  const {sheet, st, onProgress} = ctx;
  if (!window.JSZip) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
  const tpl = await loadTemplate();
  try { await document.fonts.ready; } catch (e) {}
  const pages = [...sheet.querySelectorAll('.page')];
  if (!pages.length) throw new Error('no preview');
  const csat = st.style === 'csat';

  const padT = parseFloat(pages[0].style.paddingTop) || 34;
  const titleEl = pages[0].querySelector('[data-edit="area"], [data-edit="title"]');
  const subEl = pages[0].querySelector('[data-edit="sub"]');
  const title = (titleEl && titleEl.textContent.trim()) || '시험지';
  const sub = (subEl && subEl.textContent.trim()) || '';

  // 쪽마다 고정 그림 모으기
  const pageFloats = [];
  let done = 0;
  const totalJobs = pages.reduce((a, p) => a + p.querySelectorAll('.qb').length, 0) + pages.length;
  const tick = () => { done++; if (onProgress) onProgress(done, totalJobs); };
  for (const [pi, page] of pages.entries()) {
    const fl = [];
    const head = page.querySelector('.c-head, .p-head');
    if (head) fl.push(await snap(page, head, 3, {alpha: true}));
    const foot = page.querySelector('.c-foot, .p-foot');
    if (foot) fl.push(await snap(page, foot, 3, {alpha: true}));
    // 단 구분선
    const pr = page.getBoundingClientRect(), z = pr.width / PW;
    page.querySelectorAll('.p-col').forEach(col => {
      const cs = getComputedStyle(col), bwid = parseFloat(cs.borderLeftWidth) || 0;
      if (bwid && cs.borderLeftStyle !== 'none') {
        const r = col.getBoundingClientRect();
        fl.push({solid: [(r.left - pr.left) / z, (r.top - pr.top) / z, bwid, r.height / z, cs.borderLeftColor]});
      }
    });
    // 문항 (번호 · 구분 표시 · 출처 포함, 원본 해상도로)
    for (const qb of page.querySelectorAll('.qb')) {
      const img = qb.querySelector('.qimg img');
      const F = img ? Math.min(3.2, Math.max(2, img.naturalWidth / (img.getBoundingClientRect().width / z) || 2.6)) : 2.6;
      const parts = [...qb.children];
      fl.push(await snap(page, parts, F, {}));
      tick();
    }
    // 문항 정보표
    const key = page.querySelector('.key-title');
    if (key) fl.push(await snap(page, [key, page.querySelector('.keytable')], 2.5, {}));
    tick();
    for (let i = 0; i < fl.length; i++) if (fl[i].solid) fl[i] = await solid(...fl[i].solid);
    pageFloats.push(fl);
  }

  const all = pageFloats.flat();
  const {header} = patchHeader(tpl['Contents/header.xml'], all.length, []);

  // 쪽 설정(A4, 여백은 미리보기와 같게)과 문단
  let sec = tpl['Contents/section0.xml'];
  sec = sec.replace(/<hp:margin [^>]*\/>/, `<hp:margin header="0" footer="0" gutter="0" left="${U(44)}" right="${U(44)}" top="${U(padT)}" bottom="${U(20)}"/>`);
  let body = '', bi = 0, zo = 0;
  pageFloats.forEach((fl, pi) => {
    const pics = fl.map(f => floatPic(binId(bi++), f, zo++)).join('');
    body += para(pics + run(0, '<hp:t/>'), {pageBreak: pi === 0 ? 0 : 1});
  });
  sec = sec.replace('</hs:sec>', body + '</hs:sec>');

  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const hpf = tpl['Contents/content.hpf'].replace(/\{\{DATE\}\}/g, now).replace('{{TITLE}}', X(title))
    .replace('{{BINITEMS}}', all.map((_, i) => `<opf:item id="${binId(i)}" href="BinData/${binName(i)}" media-type="image/png" isEmbeded="1"/>`).join(''));

  const zip = new JSZip();
  const add = (n, d, o = {}) => zip.file(n, d, {createFolders: false, ...o});
  add('mimetype', tpl['mimetype'], {compression: 'STORE'});
  add('version.xml', tpl['version.xml']);
  add('Contents/header.xml', header);
  add('Contents/section0.xml', sec);
  add('settings.xml', tpl['settings.xml']);
  add('Contents/content.hpf', hpf);
  add('META-INF/container.xml', tpl['META-INF/container.xml']);
  add('META-INF/container.rdf', tpl['META-INF/container.rdf']);
  add('META-INF/manifest.xml', tpl['META-INF/manifest.xml']);
  all.forEach((f, i) => add('BinData/' + binName(i), f.png, {compression: 'STORE'}));
  add('Preview/PrvText.txt', [sub, title].filter(Boolean).join('\r\n'));
  add('Preview/PrvImage.png', tpl['Preview/PrvImage.png'], {compression: 'STORE'});
  return zip.generateAsync({type: 'blob', mimeType: 'application/hwp+zip', compression: 'DEFLATE', compressionOptions: {level: 6}});
};
})();
