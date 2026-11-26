/* 한글(HWPX) 시험지 만들기
   시험 문항만 그림으로 넣고, 나머지는 한글의 서식과 기능으로 만들어요.
   - 첫 쪽 제목 · 부제목 · 성명: 본문 글자 (아래 구분선은 문단 테두리)
   - 둘째 쪽부터 머리말: 제목 + 구분선 (첫 쪽 머리말 감추기)
   - 쪽 번호: 쪽 번호 매기기(바깥쪽 위) + 꼬리말의 ‘쪽 번호 / 전체 쪽수’ 필드
   - 2단 · 단 구분선: 다단 설정, 단마다 문항 수는 단 나누기로
   - 5지선다형 · 단답형 표시, 출처, 문항 정보표: 글자
   기본 틀(hwpx/)은 python-hwpx(Apache-2.0)의 빈 문서를 바탕으로 했어요. */
(function(){
'use strict';
const U = px => Math.max(0, Math.round(px * 75));            // 96dpi 화소 → HWPUNIT(1/7200 inch)
const PT = pt => pt * 96 / 72;                               // pt → 화소
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
const nid = () => String(1300000000 + (++seq) * 7919 % 700000000 + Math.floor(Math.random() * 997));

/* ---------- 글자 모양 · 문단 모양 · 테두리 ---------- */
function makeStyles(h){
  const cp0 = h.match(/<hh:charPr id="0"[\s\S]*?<\/hh:charPr>/)[0];
  const pp0 = h.match(/<hh:paraPr id="0"[\s\S]*?<\/hh:paraPr>/)[0];
  const bf2 = h.match(/<hh:borderFill id="2"[\s\S]*?<\/hh:borderFill>/)[0];
  let nCP = +h.match(/<hh:charProperties itemCnt="(\d+)"/)[1];
  let nPP = +h.match(/<hh:paraProperties itemCnt="(\d+)"/)[1];
  let nBF = +h.match(/<hh:borderFills itemCnt="(\d+)"/)[1];
  const cps = [], pps = [], bfs = [], ppCache = {}, bfCache = {};
  const cp = (pt, {bold = false, color = '#000000', spacing = 0} = {}) => {
    const id = nCP++;
    let x = cp0.replace('id="0"', `id="${id}"`).replace('height="1000"', `height="${Math.round(pt * 100)}"`)
      .replace(/textColor="[^"]*"/, `textColor="${color}"`)
      .replace(/<hh:fontRef[^>]*\/>/, '<hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>');
    if (spacing) x = x.replace(/<hh:spacing [^>]*\/>/, `<hh:spacing hangul="${spacing}" latin="${spacing}" hanja="${spacing}" japanese="${spacing}" other="${spacing}" symbol="${spacing}" user="${spacing}"/>`);
    if (bold) x = x.replace('<hh:underline', '<hh:bold/><hh:underline');
    cps.push(x); return id;
  };
  const rule = (width, color) => {                         // 아래쪽만 선이 있는 문단 테두리
    const key = width + color; if (bfCache[key]) return bfCache[key];
    const id = ++nBF;
    bfs.push(bf2.replace('id="2"', `id="${id}"`).replace(/<hh:bottomBorder[^>]*\/>/, `<hh:bottomBorder type="SOLID" width="${width}" color="${color}"/>`));
    return bfCache[key] = id;
  };
  const pp = (align, {prev = 0, next = 0, line = 100, border = 0, borderGap = 0} = {}) => {
    const key = [align, prev, next, line, border, borderGap].join('|'); if (ppCache[key] !== undefined) return ppCache[key];
    const id = nPP++;
    pps.push(pp0.replace('id="0"', `id="${id}"`).replace('horizontal="JUSTIFY"', `horizontal="${align}"`)
      .replace('snapToGrid="1"', 'snapToGrid="0"')
      .replace(/<hh:lineSpacing type="PERCENT" value="160"/g, `<hh:lineSpacing type="PERCENT" value="${line}"`)
      .replace(/<hc:prev value="0" unit="HWPUNIT"\/>/g, `<hc:prev value="${prev}" unit="HWPUNIT"/>`)
      .replace(/<hc:next value="0" unit="HWPUNIT"\/>/g, `<hc:next value="${next}" unit="HWPUNIT"/>`)
      .replace('<hh:border borderFillIDRef="2" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0"',
               `<hh:border borderFillIDRef="${border || 2}" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="${borderGap}"`));
    return ppCache[key] = id;
  };
  const finish = (binCount) => {
    let out = h.replace(/<hh:charProperties itemCnt="\d+">/, `<hh:charProperties itemCnt="${nCP}">`).replace('</hh:charProperties>', cps.join('') + '</hh:charProperties>')
      .replace(/<hh:paraProperties itemCnt="\d+">/, `<hh:paraProperties itemCnt="${nPP}">`).replace('</hh:paraProperties>', pps.join('') + '</hh:paraProperties>')
      .replace(/<hh:borderFills itemCnt="\d+">/, `<hh:borderFills itemCnt="${nBF}">`).replace('</hh:borderFills>', bfs.join('') + '</hh:borderFills>');
    if (binCount) {
      let bins = '';
      for (let i = 0; i < binCount; i++) bins += `<hh:binItem id="${i}" Type="Embedding" BinData="${binName(i)}" Format="png"/>`;
      out = out.replace('</hh:refList>', `<hh:binDataList itemCnt="${binCount}">${bins}</hh:binDataList></hh:refList>`);
    }
    return out;
  };
  return {cp, pp, rule, finish};
}
const binId = i => 'BIN' + String(i + 1).padStart(4, '0');
const binName = i => binId(i) + '.png';

/* ---------- 본문 조각 ---------- */
const para = (inner, {pp = 0, colBreak = 0, pageBreak = 0} = {}) =>
  `<hp:p id="${nid()}" paraPrIDRef="${pp}" styleIDRef="0" pageBreak="${pageBreak}" columnBreak="${colBreak}" merged="0">${inner}</hp:p>`;
const run = (cp, inner) => `<hp:run charPrIDRef="${cp}">${inner}</hp:run>`;
const text = (t, cp) => run(cp, t ? `<hp:t>${X(t)}</hp:t>` : '<hp:t/>');
const colCtrl = (n, gap, line, color) => `<hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="${n}" sameSz="1" sameGap="${n > 1 ? gap : 0}">${line && n > 1 ? `<hp:colLine type="SOLID" width="${line}" color="${color}"/>` : ''}</hp:colPr></hp:ctrl>`;
const autoNum = type => `<hp:ctrl><hp:autoNum num="1" numType="${type}"><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar="" supscript="0"/></hp:autoNum></hp:ctrl>`;
const subList = (vAlign, w, h, paras) =>
  `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="${vAlign}" linkListIDRef="0" linkListNextIDRef="0" textWidth="${w}" textHeight="${h}" hasTextRef="0" hasNumRef="0">${paras}</hp:subList>`;
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

/* ---------- 문항 그림: 새 번호를 그림에 입혀요 ---------- */
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
  return (await new Promise(r => c.toBlob(r, 'image/png'))).arrayBuffer();
}

/* ---------- 문서 만들기 ---------- */
window.makeHwpx = async function(ctx){
  const {pages, st, G, PW, PH, imgSrc, srcSheet, unitShort, onProgress} = ctx;
  if (!window.JSZip) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
  const tpl = await loadTemplate();
  const csat = st.style === 'csat', cols = +st.cols, per = +st.perCol || 0;
  const title = (csat ? st.area : st.title) || '';
  const S = makeStyles(tpl['Contents/header.xml']);

  // 문항 목록 (단 나누기 위치, 단의 마지막 문항)
  const items = [];
  pages.forEach((p, pi) => p.cols.forEach((c, ci) => c.forEach((it, k) =>
    items.push({...it, newCol: k === 0 && !(pi === 0 && ci === 0), lastInCol: k === c.length - 1}))));
  const pngs = [];
  for (let i = 0; i < items.length; i++) {
    pngs.push(await questionPng(items[i].q, items[i].n, imgSrc(items[i].q), st.renum));
    if (onProgress) onProgress(i + 1, items.length);
  }

  // 글자 모양
  const C = {
    name: S.cp(9, {color: '#333333'}),
    sub: S.cp(csat ? 12 : 10, {color: '#222222'}),
    title: S.cp(csat ? 24 : 20, {bold: true}),
    meta: S.cp(9, {color: '#444444'}),
    head: S.cp(18, {bold: true}),
    label: S.cp(10, {bold: true, spacing: 40}),
    src: S.cp(7.5, {color: '#888888'}),
    foot: S.cp(9),
    footSrc: S.cp(7, {color: '#888888'}),
    keyHead: S.cp(15, {bold: true}),
    key: S.cp(10),
  };
  const ruleBF = S.rule(csat ? '0.5 mm' : '0.4 mm', '#000000');
  const align = csat ? 'CENTER' : 'LEFT';

  // 쪽 설정 (여백은 미리보기와 같게)
  const innerW = PW - G.padX * 2;
  const headerH = csat ? G.headN : 0;
  let sec = tpl['Contents/section0.xml'];
  sec = sec.replace(/<hp:margin [^>]*\/>/, `<hp:margin header="${U(headerH)}" footer="${U(G.foot)}" gutter="0" left="${U(G.padX)}" right="${U(G.padX)}" top="${U(G.padT)}" bottom="${U(G.padB)}"/>`);
  if (csat) sec = sec.replace('hideFirstHeader="0"', 'hideFirstHeader="1"');

  // 머리말(둘째 쪽부터) · 꼬리말 · 쪽 번호
  let ctrls = '';
  if (csat) {
    const hp = para(text(title, C.head), {pp: S.pp('CENTER', {prev: U(12), border: ruleBF, borderGap: U(7)})});
    ctrls += `<hp:ctrl><hp:header id="${nid()}" applyPageType="BOTH">${subList('TOP', U(innerW), U(headerH), hp)}</hp:header></hp:ctrl>`;
  }
  const fp = para(run(C.foot, autoNum('PAGE')) + text(' / ', C.foot) + run(C.foot, autoNum('TOTAL_PAGE')), {pp: S.pp('CENTER', {prev: U(8)})})
           + para(text('문항 출처: 한국교육과정평가원 · 비영리 학습용', C.footSrc), {pp: S.pp('RIGHT')});
  ctrls += `<hp:ctrl><hp:footer id="${nid()}" applyPageType="BOTH">${subList('BOTTOM', U(innerW), U(G.foot), fp)}</hp:footer></hp:ctrl>`;
  if (csat) ctrls += '<hp:ctrl><hp:pageNum pos="OUTSIDE_TOP" formatType="DIGIT" sideChar=""/></hp:ctrl>';
  sec = sec.replace(/(<hp:colPr [^>]*\/><\/hp:ctrl>)/, '$1' + ctrls);

  // 첫 쪽 머리 (본문)
  let body = '';
  if (csat) {
    if (st.name) body += para(text('성명 :                         ', C.name), {pp: S.pp('LEFT')});
    body += para(text(st.sub || '', C.sub), {pp: S.pp('CENTER', {prev: st.name ? 0 : U(8)})});
    body += para(text(title, C.title), {pp: S.pp('CENTER', {prev: U(2), border: ruleBF, borderGap: U(6)})});
  } else {
    const total = items.reduce((a, it) => a + it.q.score, 0);
    const meta = `${items.length}문항 · ${total}점${st.time ? ' · ' + st.time : ''}${st.name ? '      성명 :                    ' : ''}`;
    body += para(text(meta, C.meta), {pp: S.pp('RIGHT')});
    body += para(text(st.sub || '', C.sub), {pp: S.pp('LEFT')});
    body += para(text(title, C.title), {pp: S.pp('LEFT', {prev: U(2), border: ruleBF, borderGap: U(8)})});
  }

  // 문항: 그림 + 글자, 단 나누기와 문단 간격으로 미리보기와 같은 자리
  const LBL = PT(10) + 8, SRC = PT(7.5) + 3;               // 한글에서 구분 표시 · 출처 줄이 차지하는 높이(화소)
  const gaps = {s: 18, m: 70, l: 160, xl: 280};
  const lineW = csat ? '0.7 mm' : '0.12 mm', lineC = csat ? '#000000' : '#BBBBBB';
  items.forEach((it, i) => {
    const q = it.q, w = U(q.w * it.k), h = U(q.h * it.k);
    const content = q.h * it.k + (it.label ? LBL : 0) + (st.source ? SRC : 0);
    const room = it.lastInCol ? 0 : Math.max(0, per ? (it.h - content) * 0.9 : gaps[st.gap] * 0.9);
    const lead = i === 0 ? run(0, colCtrl(cols, U(G.colGap), lineW, lineC)) : '';
    let first = true;
    const brk = () => { const b = first && it.newCol ? 1 : 0; first = false; return b; };
    if (it.label) body += para(lead + text(it.label, C.label), {pp: S.pp('LEFT', {next: U(8)}), colBreak: brk()});
    body += para((it.label ? '' : lead) + run(0, pic(binId(i), w, h, i)),
      {pp: S.pp('LEFT', {next: st.source ? 0 : U(room)}), colBreak: brk()});
    if (st.source) body += para(text(srcSheet(q), C.src), {pp: S.pp('LEFT', {prev: U(3), next: U(room)})});
  });

  // 문항 정보표 (글자)
  if (st.key) {
    body += para(run(0, colCtrl(1, 0, '', '')) + text('문항 정보표', C.keyHead), {pp: S.pp('LEFT', {next: U(10)}), pageBreak: 1});
    items.forEach(it => {
      body += para(text(`${st.renum ? it.n : it.q.num}.   ${srcSheet(it.q)}   ·   ${unitShort(it.q.unit)}   ·   ${it.q.score}점        정답: ________`, C.key),
        {pp: S.pp('LEFT', {line: 130})});
    });
  }
  sec = sec.replace('</hs:sec>', body + '</hs:sec>');

  const header = S.finish(pngs.length);
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const hpf = tpl['Contents/content.hpf'].replace(/\{\{DATE\}\}/g, now).replace('{{TITLE}}', X(title || '시험지'))
    .replace('{{BINITEMS}}', pngs.map((_, i) => `<opf:item id="${binId(i)}" href="BinData/${binName(i)}" media-type="image/png" isEmbeded="1"/>`).join(''));

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
  pngs.forEach((b, i) => add('BinData/' + binName(i), b, {compression: 'STORE'}));
  add('Preview/PrvText.txt', [st.sub, title].filter(Boolean).join('\r\n'));
  add('Preview/PrvImage.png', tpl['Preview/PrvImage.png'], {compression: 'STORE'});
  return zip.generateAsync({type: 'blob', mimeType: 'application/hwp+zip', compression: 'DEFLATE', compressionOptions: {level: 6}});
};
})();
