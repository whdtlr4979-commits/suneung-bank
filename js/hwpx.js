/* 한글(HWPX) 시험지 만들기
   HWPX는 한글 2014 이후 버전이 여는 XML 기반 문서 형식이에요.
   기본 틀(hwpx/)은 python-hwpx(Apache-2.0)의 빈 문서를 바탕으로 했어요. */
(function(){
'use strict';
const U = px => Math.max(1, Math.round(px * 75));          // 96dpi 화소 → HWPUNIT(1/7200 inch)
const X = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const TPL_FILES = ['mimetype','version.xml','settings.xml','META-INF/container.xml','META-INF/container.rdf','META-INF/manifest.xml',
  'Contents/header.xml','Contents/content.hpf','Contents/section0.xml','Preview/PrvImage.png'];
let tplCache = null;
async function loadTemplate(){
  if (tplCache) return tplCache;
  const out = {};
  await Promise.all(TPL_FILES.map(async f => {
    const r = await fetch('hwpx/' + f, {cache:'force-cache'});
    if (!r.ok) throw new Error('template ' + f);
    out[f] = f.endsWith('.png') ? await r.arrayBuffer() : await r.text();
  }));
  return tplCache = out;
}
function loadScript(src){
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
let seq = 0;
const nid = () => String(1100000000 + (++seq) * 7919 % 900000000 + Math.floor(Math.random() * 1000));

/* ---------- header.xml: 글자 모양 · 문단 모양 · 테두리 · 그림 목록 ---------- */
function patchHeader(h, binCount){
  const cp0 = h.match(/<hh:charPr id="0"[\s\S]*?<\/hh:charPr>/)[0];
  const pp0 = h.match(/<hh:paraPr id="0"[\s\S]*?<\/hh:paraPr>/)[0];
  const bf2 = h.match(/<hh:borderFill id="2"[\s\S]*?<\/hh:borderFill>/)[0];
  const nCP = +h.match(/<hh:charProperties itemCnt="(\d+)"/)[1];
  const nPP = +h.match(/<hh:paraProperties itemCnt="(\d+)"/)[1];
  const nBF = +h.match(/<hh:borderFills itemCnt="(\d+)"/)[1];

  const cpDefs = [
    ['title', 2800, {bold:true}], ['sub', 1300, {}], ['src', 750, {color:'#777777'}],
    ['label', 1050, {bold:true}], ['name', 950, {}], ['keyHead', 1500, {bold:true}], ['key', 1000, {}],
  ];
  const CP = {};
  const cps = cpDefs.map(([k, height, o], i) => {
    const id = nCP + i; CP[k] = id;
    let x = cp0.replace('id="0"', `id="${id}"`).replace('height="1000"', `height="${height}"`)
      .replace(/textColor="[^"]*"/, `textColor="${o.color || '#000000'}"`)
      .replace(/<hh:fontRef[^>]*\/>/, '<hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>');
    if (o.bold) x = x.replace('<hh:underline', '<hh:bold/><hh:underline');
    return x;
  });
  const ruleBF = nBF + 1;
  const bf = bf2.replace('id="2"', `id="${ruleBF}"`).replace(/<hh:bottomBorder[^>]*\/>/, '<hh:bottomBorder type="SOLID" width="0.5 mm" color="#000000"/>');
  const ppDefs = [
    ['center', 'CENTER', 130, 0, 2], ['left', 'LEFT', 130, 0, 2], ['right', 'RIGHT', 130, 0, 2],
    ['tight', 'LEFT', 100, 0, 2], ['ruleC', 'CENTER', 120, 1400, ruleBF], ['ruleL', 'LEFT', 120, 1400, ruleBF],
  ];
  const PP = {};
  const pps = ppDefs.map(([k, align, ls, next, bfId], i) => {
    const id = nPP + i; PP[k] = id;
    return pp0.replace('id="0"', `id="${id}"`).replace('horizontal="JUSTIFY"', `horizontal="${align}"`)
      .replace(/<hh:lineSpacing type="PERCENT" value="160"/g, `<hh:lineSpacing type="PERCENT" value="${ls}"`)
      .replace(/<hc:next value="0" unit="HWPUNIT"\/>/g, `<hc:next value="${next}" unit="HWPUNIT"/>`)
      .replace('<hh:border borderFillIDRef="2"', `<hh:border borderFillIDRef="${bfId}"`);
  });
  let bins = '';
  for (let i = 0; i < binCount; i++) bins += `<hh:binItem id="${i}" Type="Embedding" BinData="${binName(i)}" Format="png"/>`;
  h = h.replace(/<hh:charProperties itemCnt="\d+">/, `<hh:charProperties itemCnt="${nCP + cps.length}">`).replace('</hh:charProperties>', cps.join('') + '</hh:charProperties>')
       .replace(/<hh:paraProperties itemCnt="\d+">/, `<hh:paraProperties itemCnt="${nPP + pps.length}">`).replace('</hh:paraProperties>', pps.join('') + '</hh:paraProperties>')
       .replace(/<hh:borderFills itemCnt="\d+">/, `<hh:borderFills itemCnt="${nBF + 1}">`).replace('</hh:borderFills>', bf + '</hh:borderFills>');
  if (binCount) h = h.replace('</hh:refList>', `<hh:binDataList itemCnt="${binCount}">${bins}</hh:binDataList></hh:refList>`);
  return {header: h, CP, PP};
}
const binId = i => 'BIN' + String(i + 1).padStart(4, '0');
const binName = i => binId(i) + '.png';

/* ---------- section0.xml 조각 ---------- */
const para = (inner, {pp = 0, colBreak = 0, pageBreak = 0} = {}) =>
  `<hp:p id="${nid()}" paraPrIDRef="${pp}" styleIDRef="0" pageBreak="${pageBreak}" columnBreak="${colBreak}" merged="0">${inner}</hp:p>`;
const run = (cp, inner) => `<hp:run charPrIDRef="${cp}">${inner}</hp:run>`;
const text = (t, cp) => run(cp, `<hp:t>${X(t)}</hp:t>`);
const empty = pp => para(run(0, '<hp:t/>'), {pp});
const colCtrl = (n, gap, line) => `<hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="${n}" sameSz="1" sameGap="${n > 1 ? gap : 0}">${line && n > 1 ? `<hp:colLine type="SOLID" width="${line}" color="#000000"/>` : ''}</hp:colPr></hp:ctrl>`;
function pic(bin, w, h, z){
  const i = nid();
  return `<hp:pic id="${i}" zOrder="${z}" numberingType="PICTURE" textWrap="SQUARE" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${i}" reverse="0">`
    + `<hp:offset x="0" y="0"/><hp:orgSz width="${w}" height="${h}"/><hp:curSz width="${w}" height="${h}"/><hp:flip horizontal="0" vertical="0"/>`
    + `<hp:rotationInfo angle="0" centerX="${w >> 1}" centerY="${h >> 1}" rotateimage="1"/>`
    + `<hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo>`
    + `<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="${w}" y="0"/><hc:pt2 x="${w}" y="${h}"/><hc:pt3 x="0" y="${h}"/></hp:imgRect>`
    + `<hp:imgClip left="0" right="${w}" top="0" bottom="${h}"/><hp:inMargin left="0" right="0" top="0" bottom="0"/><hp:imgDim dimwidth="${w}" dimheight="${h}"/>`
    + `<hc:img binaryItemIDRef="${bin}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/><hp:effects/>`
    + `<hp:sz width="${w}" widthRelTo="ABSOLUTE" height="${h}" heightRelTo="ABSOLUTE" protect="0"/>`
    + `<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>`
    + `<hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:shapeComment/></hp:pic>`;
}

/* ---------- 문항 그림: 새 번호를 그림에 직접 입혀요 ---------- */
function loadImg(src){ return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
async function questionPng(q, n, src, renum){
  if (!renum) return (await fetch(src)).arrayBuffer();
  const img = await loadImg(src);
  const c = document.createElement('canvas'); c.width = q.w; c.height = q.h;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0);
  const [x0, y0, x1, y1] = q.nb, fs = (y1 - y0) * 1.02, label = n + '.';
  g.fillRect(x0 - 1, y0 - 1, x1 - x0 + 6, y1 - y0 + 2);
  g.font = `bold ${fs}px "Times New Roman", "Noto Serif KR", serif`; g.fillStyle = '#000'; g.textBaseline = 'middle';
  const tw = g.measureText(label).width, maxW = x1 - x0 + 4;
  g.save(); g.translate(x0, (y0 + y1) / 2 + fs * 0.04); if (tw > maxW) g.scale(maxW / tw, 1); g.fillText(label, 0, 0); g.restore();
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  return blob.arrayBuffer();
}

/* ---------- 문서 만들기 ---------- */
window.makeHwpx = async function(ctx){
  const {qs, pages, st, G, PW, PH, labelH, srcH, gaps, imgSrc, srcSheet, unitShort, onProgress} = ctx;
  if (!window.JSZip) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
  const tpl = await loadTemplate();
  const csat = st.style === 'csat';
  const title = (csat ? st.area : st.title) || '시험지';
  const items = [];
  pages.forEach((p, pi) => p.cols.forEach((c, ci) => c.forEach((it, k) => items.push({...it, newCol: k === 0 && !(pi === 0 && ci === 0)}))));

  // 그림
  const pngs = [];
  for (let i = 0; i < items.length; i++) {
    pngs.push(await questionPng(items[i].q, items[i].n, imgSrc(items[i].q), st.renum));
    if (onProgress) onProgress(i + 1, items.length);
  }
  const {header, CP, PP} = patchHeader(tpl['Contents/header.xml'], pngs.length);

  // 쪽 설정: 미리보기와 같은 여백
  let sec = tpl['Contents/section0.xml'];
  sec = sec.replace(/<hp:margin [^>]*\/>/, `<hp:margin header="0" footer="${U(G.foot)}" gutter="0" left="${U(G.padX)}" right="${U(G.padX)}" top="${U(G.padT)}" bottom="${U(G.padB)}"/>`);
  sec = sec.replace(/(<hp:colPr [^>]*\/><\/hp:ctrl>)/, `$1<hp:ctrl><hp:pageNum pos="BOTTOM_CENTER" formatType="DIGIT" sideChar=""/></hp:ctrl>`);

  let body = '';
  // 머리글 (첫 쪽)
  if (st.name) body += para(text('성명                                ', CP.name), {pp: PP.left});
  if (st.sub) body += para(text(st.sub, CP.sub), {pp: csat ? PP.center : PP.left});
  body += para(text(title, CP.title), {pp: csat ? PP.ruleC : PP.ruleL});
  if (!csat && st.time) body += para(text(st.time, CP.name), {pp: PP.right});

  // 문항 (2단 또는 1단)
  const cols = +st.cols, colLine = csat ? '0.5 mm' : '0.12 mm';
  const LINE = 13.4; // 빈 줄 하나의 대략적인 높이(px)
  items.forEach((it, i) => {
    const q = it.q, w = U(q.w * it.k), h = U(q.h * it.k);
    const lead = (i === 0 ? run(0, colCtrl(cols, U(G.colGap), colLine)) : '');
    const cb = it.newCol ? 1 : 0;
    let first = true;
    const opt = extra => { const o = {pp: PP.tight, colBreak: first ? cb : 0, ...extra}; first = false; return o; };
    if (it.label) body += para(lead + text(it.label, CP.label), opt());
    body += para((it.label ? '' : lead) + run(0, pic(binId(i), w, h, i)), opt());
    if (st.source) body += para(text(srcSheet(q), CP.src), opt());
    const used = q.h * it.k + (it.label ? labelH : 0) + (st.source ? srcH : 0);
    const room = it.h ? (it.h - used) * 0.85 : (gaps[st.gap] || 70);
    const lines = Math.max(it.h ? 0 : 1, Math.floor(room / LINE));
    for (let j = 0; j < lines; j++) body += empty(PP.tight);
  });

  // 문항 정보표
  if (st.key) {
    body += para(run(0, colCtrl(1, 0, '')) + text('문항 정보표', CP.keyHead), {pp: PP.left, pageBreak: 1});
    items.forEach(it => {
      body += para(text(`${st.renum ? it.n : it.q.num}.   ${srcSheet(it.q)}   ·   ${unitShort(it.q.unit)}   ·   ${it.q.score}점        정답: ________`, CP.key), {pp: PP.left});
    });
  }
  body += para(text('문항 출처: 한국교육과정평가원 · 비영리 학습용', CP.src), {pp: PP.right});
  sec = sec.replace('</hs:sec>', body + '</hs:sec>');

  // content.hpf
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  let hpf = tpl['Contents/content.hpf'].replace(/\{\{DATE\}\}/g, now).replace('{{TITLE}}', X(title))
    .replace('{{BINITEMS}}', pngs.map((_, i) => `<opf:item id="${binId(i)}" href="BinData/${binName(i)}" media-type="image/png" isEmbeded="1"/>`).join(''));

  const zip = new JSZip();
  const _file = zip.file.bind(zip);
  zip.file = (n, d, o = {}) => _file(n, d, {createFolders: false, ...o});
  zip.file('mimetype', tpl['mimetype'], {compression: 'STORE'});
  zip.file('version.xml', tpl['version.xml']);
  zip.file('Contents/header.xml', header);
  zip.file('Contents/section0.xml', sec);
  zip.file('settings.xml', tpl['settings.xml']);
  zip.file('Contents/content.hpf', hpf);
  zip.file('META-INF/container.xml', tpl['META-INF/container.xml']);
  zip.file('META-INF/container.rdf', tpl['META-INF/container.rdf']);
  zip.file('META-INF/manifest.xml', tpl['META-INF/manifest.xml']);
  pngs.forEach((b, i) => zip.file('BinData/' + binName(i), b, {compression: 'STORE'}));
  zip.file('Preview/PrvText.txt', [st.sub, title].filter(Boolean).join('\r\n'));
  zip.file('Preview/PrvImage.png', tpl['Preview/PrvImage.png'], {compression: 'STORE'});
  return zip.generateAsync({type: 'blob', mimeType: 'application/hwp+zip', compression: 'DEFLATE', compressionOptions: {level: 6}});
};
})();
