(function(){
'use strict';
const D = window.QB;
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (name, cls='') => `<svg class="ic ${cls}"><use href="#i-${name}"/></svg>`;
const BOX = '<span class="box"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></span>';
const nf = n => n.toLocaleString('ko-KR');

/* ---------------- data ---------------- */
const EXAM_NAME = D.exams;                 // 수능, 6월 모평, 9월 모평
const EXAM_SHORT = ['수능','6월','9월'];
const EXAM_FULL = ['수능','6월 모의평가','9월 모의평가'];
const EXAM_ORDER = [2,0,1];                // 한 해 안의 시행 순서: 6월 → 9월 → 수능
const Q = D.rows.map((r,i) => ({
  i, id:r[0], exam:r[1], year:r[2], type:r[3], num:r[4], score:r[5], unit:r[6],
  w:r[7], h:r[8], nb:[r[9],r[10],r[11],r[12]], text:r[13]
}));
const byId = new Map(Q.map(q => [q.id, q]));
const YEARS = [...new Set(Q.map(q => q.year))].sort((a,b) => a-b);
const Y0 = YEARS[0], Y1 = YEARS[YEARS.length-1];
const MAXW = Math.max(...Q.map(q => q.w));
const UNITS = D.units;
const UNIT_GROUPS = [
  ['지수 · 로그', ['지수와로그','지수함수와로그함수']],
  ['삼각함수', ['삼각함수']],
  ['수열', ['수열']],
  ['극한', ['수열의극한','함수의극한과연속']],
  ['미분', ['미분','미분법']],
  ['적분', ['적분','적분법']],
  ['경우의 수', ['순열과조합','경우의수']],
  ['확률', ['확률']],
  ['통계', ['통계']],
  ['이차곡선', ['이차곡선']],
  ['벡터', ['평면벡터','공간벡터']],
  ['공간도형', ['공간도형과공간좌표']],
  ['행렬', ['행렬','행렬과그래프','일차변환과행렬']],
  ['집합 · 함수 · 방정식', ['집합과명제','함수','방정식과부등식']],
].map(([name, us]) => ({name, units: us.map(u => UNITS.indexOf(u))}));
const UNIT_LABEL = {
  '지수와로그':'지수와 로그','지수함수와로그함수':'지수함수와 로그함수','수열의극한':'수열의 극한',
  '함수의극한과연속':'함수의 극한과 연속','순열과조합':'순열과 조합','경우의수':'경우의 수',
  '공간도형과공간좌표':'공간도형과 공간좌표','행렬과그래프':'행렬과 그래프','일차변환과행렬':'일차변환과 행렬',
  '집합과명제':'집합과 명제','방정식과부등식':'방정식과 부등식','미분법':'미분법 (초월함수)','적분법':'적분법 (초월함수)',
  '미분':'미분 (다항함수)','적분':'적분 (다항함수)'
};
const unitName = u => UNIT_LABEL[UNITS[u]] || UNITS[u];
const unitShort = u => unitName(u).replace(/ \(.+\)$/, '');
const groupOfUnit = u => UNIT_GROUPS.findIndex(g => g.units.includes(u));
const TYPE_GROUPS = [['2021년 이후', [4,5,6,7]], ['2016–2020년', [2,3]], ['2013–2015년', [0,1]]];
const TYPE_NAME = ['수학 A형','수학 B형','가형','나형','공통','확률과 통계','미적분','기하'];
const isShort = q => q.year <= 2020 ? q.num >= 22 : (q.type === 4 ? q.num >= 16 : q.num >= 29);
const imgSrc = q => `img/${q.year}/${q.id}.png`;

/* ---------------- storage ---------------- */
const KEY = 'qbank.v1';
const DEF_SETTINGS = {style:'csat', title:'실전 모의고사 문제지', sub:'', time:'', area:'수학 모의고사', cols:'2', perCol:'2', gap:'m', renum:true, labels:true, source:true, name:true, key:true};
let S = {basket:[], fav:{}, status:{}, notes:{}, sets:[], settings:{...DEF_SETTINGS}, prefs:{}};
try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(S, JSON.parse(raw)); } catch(e) {}
S.settings = Object.assign({...DEF_SETTINGS}, S.settings || {});
if (!S.settings.area || S.settings.area === '수학 영역') S.settings.area = DEF_SETTINGS.area;
delete S.settings.period; delete S.settings.form;
S.prefs = S.prefs || {};
S.basket = (S.basket || []).filter(id => byId.has(id));
let saveTimer;
function save(){ clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e) {} }, 150); }

/* ---------------- labels ---------------- */
const yearMode = () => S.prefs.yearMode || 'exam';
const yLabel = y => yearMode() === 'hak' ? `${y+1}학년도` : `${y}년`;
const yShort = y => yearMode() === 'hak' ? `${y+1}학년도` : `${y}`;
const qTitle = q => `${yShort(q.year)} ${EXAM_SHORT[q.exam]} ${q.num}번`;
const qSub = q => q.type >= 4 ? TYPE_NAME[q.type] : TYPE_NAME[q.type];
const srcSheet = q => `${q.year+1}학년도 ${EXAM_FULL[q.exam]} ${TYPE_NAME[q.type]} ${q.num}번`;

function toast(msg){
  const t = $('#toast'); t.innerHTML = icon('check') + esc(msg); t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1900);
}

/* ---------------- theme ---------------- */
const mq = matchMedia('(prefers-color-scheme: dark)');
function applyTheme(){
  const t = S.prefs.theme || (mq.matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', t);
  $('#themeBtn use').setAttribute('href', t === 'dark' ? '#i-sun' : '#i-moon');
  document.querySelector('meta[name=theme-color]').content = t === 'dark' ? '#17171c' : '#ffffff';
}
mq.addEventListener('change', () => { if (!S.prefs.theme) applyTheme(); });
applyTheme();
$('#themeBtn').onclick = () => {
  S.prefs.theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; applyTheme(); save();
};

/* ---------------- navigation ---------------- */
let current = 'browse';
function showTab(name){
  current = name;
  $$('.nav [data-tab], .tabbar [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  $$('.view').forEach(v => v.classList.toggle('on', v.id === 'tab-' + name));
  S.prefs.tab = name; save();
  if (name === 'builder') renderBuilder();
  if (name === 'stats') renderStats();
  if (name === 'me') renderMe();
  closeSheet();
  window.scrollTo({top:0});
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-tab]'); if (!t) return;
  e.preventDefault(); showTab(t.dataset.tab);
});

/* ================= 문제 찾기 ================= */
const F0 = () => ({q:'', exams:[], yFrom:Y0, yTo:Y1, scores:[], forms:[], types:[], units:[], nFrom:1, nTo:30, mine:'all'});
let F = Object.assign(F0(), S.prefs.filters || {});
let sortMode = S.prefs.sort || 'new';
let shuffleKey = new Map();
const reshuffle = () => { shuffleKey = new Map(Q.map(q => [q.id, Math.random()])); };
if (sortMode === 'random') reshuffle();

function test(q, skip){
  if (skip !== 'exam' && F.exams.length && !F.exams.includes(q.exam)) return false;
  if (skip !== 'year' && (q.year < F.yFrom || q.year > F.yTo)) return false;
  if (skip !== 'score' && F.scores.length && !F.scores.includes(q.score)) return false;
  if (skip !== 'form' && F.forms.length && !F.forms.includes(isShort(q) ? 'sa' : 'mc')) return false;
  if (skip !== 'type' && F.types.length && !F.types.includes(q.type)) return false;
  if (skip !== 'unit' && F.units.length && !F.units.includes(q.unit)) return false;
  if (skip !== 'num' && (q.num < F.nFrom || q.num > F.nTo)) return false;
  if (skip !== 'mine' && F.mine !== 'all'){
    const st = S.status[q.id];
    if (F.mine === 'fav' && !S.fav[q.id]) return false;
    if (['o','x','r'].includes(F.mine) && st !== F.mine) return false;
    if (F.mine === 'none' && st) return false;
    if (F.mine === 'note' && !S.notes[q.id]) return false;
  }
  if (skip !== 'q' && F.q){
    const words = F.q.trim().split(/\s+/);
    if (!words.every(w => q.text.includes(w))) return false;
  }
  return true;
}
function countBy(skip, keyFn){
  const m = new Map();
  for (const q of Q) if (test(q, skip)) { const k = keyFn(q); m.set(k, (m.get(k)||0) + 1); }
  return m;
}
function toggleIn(arr, v){ const i = arr.indexOf(v); if (i >= 0) arr.splice(i,1); else arr.push(v); }

/* quick toggles (exam / score) */
function renderToggles(){
  const ce = countBy('exam', q => q.exam), cs = countBy('score', q => q.score);
  const ex = EXAM_FULL.map((n,i) => `<button class="toggle${F.exams.includes(i)?' on':''}" data-exam="${i}" aria-pressed="${F.exams.includes(i)}">${n}<span class="n">${nf(ce.get(i)||0)}</span></button>`).join('');
  const sc = [2,3,4].map(s => `<button class="toggle${F.scores.includes(s)?' on':''}" data-score="${s}" aria-pressed="${F.scores.includes(s)}">${s}점<span class="n">${nf(cs.get(s)||0)}</span></button>`).join('');
  $('#qb-exam').innerHTML = ex; $('#mq-exam').innerHTML = ex;
  $('#qb-score').innerHTML = sc; $('#mq-score').innerHTML = sc;
}
document.addEventListener('click', e => {
  const b = e.target.closest('.toggle'); if (!b) return;
  if (b.dataset.exam !== undefined) toggleIn(F.exams, +b.dataset.exam);
  if (b.dataset.score !== undefined) toggleIn(F.scores, +b.dataset.score);
  changed();
});

/* sidebar */
function checkRow(attrs, label, checked, n, extraCls=''){
  return `<label class="check ${extraCls}${n === 0 && !checked ? ' disabled' : ''}"><input type="checkbox" ${attrs} ${checked ? 'checked' : ''}>${BOX}<span>${esc(label)}</span><span class="n">${n === undefined ? '' : nf(n)}</span></label>`;
}
function renderSidebar(){
  // year
  const opts = YEARS.map(y => `<option value="${y}">${yLabel(y)}</option>`).join('');
  $('#yearFrom').innerHTML = opts; $('#yearTo').innerHTML = opts;
  $('#yearFrom').value = F.yFrom; $('#yearTo').value = F.yTo;
  $$('#yearMode button').forEach(b => b.classList.toggle('on', b.dataset.v === yearMode()));
  const yp = [['전체', Y0, Y1], ['최근 3년', Y1-2, Y1], ['최근 5년', Y1-4, Y1], ['2021년 이후', 2021, Y1]];
  $('#yearQuick').innerHTML = yp.map(([n,a,b]) => `<button class="preset${F.yFrom===a && F.yTo===b ? ' on' : ''}" data-y="${a}-${b}">${n}</button>`).join('');
  // units
  const cu = countBy('unit', q => q.unit);
  const open = new Set(S.prefs.openGroups || []);
  $('#f-unit').innerHTML = UNIT_GROUPS.map((g, gi) => {
    const total = g.units.reduce((a,u) => a + (cu.get(u)||0), 0);
    const sel = g.units.filter(u => F.units.includes(u)).length;
    if (g.units.length === 1) return checkRow(`data-u="${g.units[0]}"`, g.name, sel === 1, total);
    const st = sel === 0 ? '' : sel === g.units.length ? 'on' : 'mixed';
    return `<div class="ugroup${open.has(gi) ? ' open' : ''}" data-g="${gi}">
      <div class="row"><label class="check parent grow${total === 0 && !sel ? ' disabled' : ''}" data-gcheck="${gi}"><span class="box ${st}"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></span><span>${esc(g.name)}</span><span class="n">${nf(total)}</span></label>
      <button class="caret" data-caret="${gi}" aria-label="${esc(g.name)} 세부 단원 펼치기" aria-expanded="${open.has(gi)}">${icon('down')}</button></div>
      <div class="ugroup-kids">${g.units.map(u => checkRow(`data-u="${u}"`, unitName(u), F.units.includes(u), cu.get(u)||0)).join('')}</div></div>`;
  }).join('');
  // types
  const ct = countBy('type', q => q.type);
  $('#f-type').innerHTML = TYPE_GROUPS.map(([label, ts]) => `<div class="sub-label">${label}</div>` +
    ts.map(t => checkRow(`data-t="${t}"`, TYPE_NAME[t], F.types.includes(t), ct.get(t)||0)).join('')).join('');
  // form
  const cf = countBy('form', q => isShort(q) ? 'sa' : 'mc');
  $('#f-form').innerHTML = [['mc','5지선다형'],['sa','단답형']].map(([k,n]) => checkRow(`data-f="${k}"`, n, F.forms.includes(k), cf.get(k)||0)).join('');
  // num
  $('#numFrom').value = F.nFrom; $('#numTo').value = F.nTo;
  $('#numQuick').innerHTML = [['전체',1,30],['1–10번',1,10],['11–20번',11,20],['21–30번',21,30]].map(([n,a,b]) =>
    `<button class="preset${F.nFrom===a && F.nTo===b ? ' on' : ''}" data-n="${a}-${b}">${n}</button>`).join('');
  // mine
  const mineOpts = [['all','전체'],['fav','북마크'],['x','틀림'],['r','다시 보기'],['o','맞음'],['none','안 푼 문항'],['note','메모']];
  $('#f-mine').innerHTML = `<div class="presets">${mineOpts.map(([k,n]) => `<button class="preset${F.mine===k ? ' on' : ''}" data-m="${k}">${n}</button>`).join('')}</div>`;
  // section badges
  const selCount = {year: (F.yFrom !== Y0 || F.yTo !== Y1) ? 1 : 0, unit: F.units.length, type: F.types.length, form: F.forms.length, num: (F.nFrom !== 1 || F.nTo !== 30) ? 1 : 0, mine: F.mine !== 'all' ? 1 : 0};
  $$('.fsec').forEach(sec => {
    const k = sec.dataset.sec; const head = sec.querySelector('.fsec-head');
    let b = head.querySelector('.sel'); if (!b) { b = document.createElement('span'); b.className = 'sel'; head.insertBefore(b, head.lastElementChild); }
    b.textContent = selCount[k] ? (k === 'unit' || k === 'type' || k === 'form' ? selCount[k] + '개' : '설정됨') : '';
    sec.classList.toggle('closed', !!(S.prefs.closed || {})[k]);
  });
  const adv = Object.values(selCount).reduce((a,b) => a + b, 0) + F.exams.length + F.scores.length;
  $('#filterBadge').textContent = adv; $('#filterBadge').classList.toggle('hidden', !adv);
}
$('#sidebar').addEventListener('click', e => {
  const head = e.target.closest('.fsec-head');
  if (head) { const k = head.parentElement.dataset.sec; S.prefs.closed = S.prefs.closed || {}; S.prefs.closed[k] = !S.prefs.closed[k]; head.parentElement.classList.toggle('closed'); save(); return; }
  const caret = e.target.closest('[data-caret]');
  if (caret) { const gi = +caret.dataset.caret; const s = new Set(S.prefs.openGroups || []); s.has(gi) ? s.delete(gi) : s.add(gi); S.prefs.openGroups = [...s]; save(); caret.closest('.ugroup').classList.toggle('open'); caret.setAttribute('aria-expanded', s.has(gi)); return; }
  const gc = e.target.closest('[data-gcheck]');
  if (gc) { e.preventDefault(); const g = UNIT_GROUPS[+gc.dataset.gcheck]; const all = g.units.every(u => F.units.includes(u));
    if (all) F.units = F.units.filter(u => !g.units.includes(u)); else g.units.forEach(u => { if (!F.units.includes(u)) F.units.push(u); }); changed(); return; }
  const p = e.target.closest('.preset');
  if (p) {
    if (p.dataset.y) { const [a,b] = p.dataset.y.split('-').map(Number); F.yFrom = a; F.yTo = b; }
    if (p.dataset.n) { const [a,b] = p.dataset.n.split('-').map(Number); F.nFrom = a; F.nTo = b; }
    if (p.dataset.m) F.mine = p.dataset.m;
    changed(); return;
  }
  const ym = e.target.closest('#yearMode button');
  if (ym) { S.prefs.yearMode = ym.dataset.v; save(); changed(); }
});
$('#sidebar').addEventListener('change', e => {
  const i = e.target;
  if (i.dataset.u !== undefined) toggleIn(F.units, +i.dataset.u);
  else if (i.dataset.t !== undefined) toggleIn(F.types, +i.dataset.t);
  else if (i.dataset.f !== undefined) toggleIn(F.forms, i.dataset.f);
  else if (i.id === 'yearFrom') { F.yFrom = +i.value; if (F.yFrom > F.yTo) F.yTo = F.yFrom; }
  else if (i.id === 'yearTo') { F.yTo = +i.value; if (F.yTo < F.yFrom) F.yFrom = F.yTo; }
  else if (i.id === 'numFrom') F.nFrom = Math.max(1, Math.min(30, +i.value || 1));
  else if (i.id === 'numTo') F.nTo = Math.max(1, Math.min(30, +i.value || 30));
  else return;
  changed();
});

/* tokens */
function renderTokens(){
  const t = [];
  const add = (label, fn) => t.push([label, fn]);
  if (F.q) add(`“${F.q}”`, () => F.q = '');
  F.exams.forEach(e => add(EXAM_FULL[e], () => toggleIn(F.exams, e)));
  F.scores.forEach(s => add(s + '점', () => toggleIn(F.scores, s)));
  if (F.yFrom !== Y0 || F.yTo !== Y1) add(F.yFrom === F.yTo ? yLabel(F.yFrom) : `${yShort(F.yFrom)}–${yShort(F.yTo)}`, () => { F.yFrom = Y0; F.yTo = Y1; });
  UNIT_GROUPS.forEach(g => {
    const sel = g.units.filter(u => F.units.includes(u));
    if (sel.length && sel.length === g.units.length) add(g.name, () => F.units = F.units.filter(u => !g.units.includes(u)));
    else sel.forEach(u => add(unitShort(u), () => toggleIn(F.units, u)));
  });
  F.types.forEach(x => add(TYPE_NAME[x], () => toggleIn(F.types, x)));
  F.forms.forEach(f => add(f === 'sa' ? '단답형' : '5지선다형', () => toggleIn(F.forms, f)));
  if (F.nFrom !== 1 || F.nTo !== 30) add(`${F.nFrom}–${F.nTo}번`, () => { F.nFrom = 1; F.nTo = 30; });
  if (F.mine !== 'all') add({fav:'북마크',x:'틀린 문항',r:'다시 볼 문항',o:'맞은 문항',none:'안 푼 문항',note:'메모한 문항'}[F.mine], () => F.mine = 'all');
  tokenFns = t.map(x => x[1]);
  $('#tokens').innerHTML = t.map(([l], i) => `<button class="token" data-k="${i}">${esc(l)}${icon('x')}</button>`).join('') +
    (t.length > 1 ? `<button class="token token-clear" data-reset>모두 지우기</button>` : '');
}
let tokenFns = [];
$('#tokens').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) { tokenFns[+b.dataset.k](); changed(); } });
document.addEventListener('click', e => { if (e.target.closest('[data-reset]')) { F = F0(); changed(); } });

/* results */
let results = [], shown = 0;
const PAGE = 36;
function sortList(list){
  const ex = q => EXAM_ORDER[q.exam];
  const cmp = {
    new: (a,b) => b.year - a.year || ex(b) - ex(a) || a.type - b.type || a.num - b.num,
    old: (a,b) => a.year - b.year || ex(a) - ex(b) || a.type - b.type || a.num - b.num,
    num: (a,b) => a.num - b.num || b.year - a.year || ex(b) - ex(a),
    scoreDesc: (a,b) => b.score - a.score || b.year - a.year || ex(b) - ex(a) || a.num - b.num,
    unit: (a,b) => a.unit - b.unit || b.year - a.year || ex(b) - ex(a) || a.num - b.num,
    random: (a,b) => shuffleKey.get(a.id) - shuffleKey.get(b.id),
  }[sortMode];
  return list.sort(cmp);
}
function changed(){
  S.prefs.filters = F; save();
  renderToggles(); renderSidebar(); renderTokens();
  results = sortList(Q.filter(q => test(q)));
  $('#resultCount').textContent = nf(results.length);
  $('#applyFilters').textContent = `${nf(results.length)}문항 보기`;
  $('#empty').classList.toggle('hidden', results.length > 0);
  $('#grid').innerHTML = ''; shown = 0; renderMore();
  if ($('#q').value.trim() !== F.q) $('#q').value = F.q;
}
function cardHTML(q){
  const st = S.status[q.id], inB = S.basket.includes(q.id), fav = !!S.fav[q.id];
  const ratio = q.h / q.w;
  return `<article class="qcard${inB ? ' in' : ''}" data-id="${q.id}" tabindex="0" aria-label="${esc(qTitle(q))} ${esc(unitShort(q.unit))} ${q.score}점">
    <div class="qmedia${ratio < 0.62 ? ' short' : ''}">
      <img loading="lazy" decoding="async" src="${imgSrc(q)}" alt="" width="${q.w}" height="${q.h}">
      <button class="qadd" data-act="add" aria-label="${inB ? '시험지에서 빼기' : '시험지에 담기'}" title="${inB ? '시험지에서 빼기' : '시험지에 담기'}">${icon(inB ? 'check' : 'plus')}</button>
    </div>
    <div class="qinfo">
      <div class="qtext">
        <div class="qtitle">${st ? `<i class="dot dot-${st}" title="${{o:'맞음',x:'틀림',r:'다시 보기'}[st]}"></i>` : ''}${esc(qTitle(q))}${S.notes[q.id] ? `<span class="qnote" title="메모 있음">${icon('pencil')}</span>` : ''}</div>
        <div class="qmeta"><span class="tag tag-s${q.score}">${q.score}점</span><span class="u">${esc(unitShort(q.unit))} · ${esc(TYPE_NAME[q.type])}</span></div>
      </div>
      <button class="qmark${fav ? ' on' : ''}" data-act="fav" aria-label="북마크" aria-pressed="${fav}">${icon('bookmark')}</button>
    </div></article>`;
}
function renderMore(){
  const slice = results.slice(shown, shown + PAGE);
  $('#grid').insertAdjacentHTML('beforeend', slice.map(cardHTML).join(''));
  shown += slice.length;
  $('#more').innerHTML = shown < results.length ? `<button class="btn btn-secondary" id="moreBtn">더 보기 <span class="muted">${nf(results.length - shown)}</span></button>` : '';
}
$('#more').addEventListener('click', e => { if (e.target.closest('#moreBtn')) renderMore(); });
const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && shown < results.length && current === 'browse') renderMore(); }, {rootMargin:'800px'});
io.observe($('#more'));
$('#grid').addEventListener('click', e => {
  const card = e.target.closest('.qcard'); if (!card) return;
  const act = e.target.closest('[data-act]'), id = card.dataset.id;
  if (act && act.dataset.act === 'add') return toggleBasket(id);
  if (act && act.dataset.act === 'fav') return toggleFav(id);
  openViewer(results.findIndex(q => q.id === id));
});
$('#grid').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('qcard')) openViewer(results.findIndex(q => q.id === e.target.dataset.id)); });
function refreshCard(id){ const c = document.querySelector(`.qcard[data-id="${id}"]`); if (c) c.outerHTML = cardHTML(byId.get(id)); }

/* toolbar */
let qTimer;
$('#q').addEventListener('input', e => { clearTimeout(qTimer); qTimer = setTimeout(() => { F.q = e.target.value.trim(); changed(); }, 250); });
document.addEventListener('keydown', e => {
  if (e.key === '/' && current === 'browse' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && $('#viewer').classList.contains('hidden')) { e.preventDefault(); $('#q').focus(); }
});
$('#sort').value = sortMode;
$('#sort').onchange = e => { sortMode = e.target.value; S.prefs.sort = sortMode; save(); if (sortMode === 'random') reshuffle(); changed(); };
function applyView(){
  const v = S.prefs.view || 'grid';
  $$('#viewSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('#grid').classList.toggle('rows', v === 'rows');
}
$('#viewSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.prefs.view = b.dataset.v; save(); applyView(); };
applyView();
$('#addAllBtn').onclick = () => {
  const add = results.filter(q => !S.basket.includes(q.id));
  if (!add.length) return toast('이미 모두 담겨 있어요');
  if (add.length > 60 && !confirm(`${nf(add.length)}문항을 모두 시험지에 담을까요?`)) return;
  add.forEach(q => S.basket.push(q.id)); basketChanged(); changed();
  toast(`${nf(add.length)}문항을 담았어요`);
};

/* mobile filter sheet */
function openSheet(){ $('#sidebar').classList.add('open'); $('#scrim').classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closeSheet(){ $('#sidebar').classList.remove('open'); if ($('#viewer').classList.contains('hidden')) { $('#scrim').classList.add('hidden'); document.body.style.overflow = ''; } }
$('#openFilters').onclick = openSheet;
$('#closeFilters').onclick = closeSheet;
$('#applyFilters').onclick = closeSheet;
$('#resetFiltersM').onclick = () => { F = F0(); changed(); };
$('#scrim').onclick = closeSheet;

/* basket & bookmark */
function toggleBasket(id){
  const i = S.basket.indexOf(id);
  if (i >= 0) { S.basket.splice(i, 1); toast('시험지에서 뺐어요'); }
  else { S.basket.push(id); toast(`시험지에 담았어요 · ${S.basket.length}문항`); }
  basketChanged(true); refreshCard(id); if (vIdx >= 0) renderViewer();
}
function toggleFav(id){
  if (S.fav[id]) { delete S.fav[id]; toast('북마크를 해제했어요'); } else { S.fav[id] = 1; toast('북마크했어요'); }
  save(); refreshCard(id); if (vIdx >= 0) renderViewer();
}
function basketChanged(bump){
  $$('[data-basket-count]').forEach(el => {
    el.textContent = S.basket.length; el.classList.toggle('zero', !S.basket.length);
    if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  });
  save();
  if (current === 'builder') renderBuilder();
}

/* ---------------- viewer ---------------- */
let vIdx = -1, vList = [];
function openViewer(i, list){
  vList = list || results; vIdx = i; if (i < 0) return;
  renderViewer(); $('#viewer').classList.remove('hidden'); document.body.style.overflow = 'hidden';
  setTimeout(() => $('#vClose').focus(), 30);
}
function closeViewer(){ $('#viewer').classList.add('hidden'); vIdx = -1; document.body.style.overflow = ''; }
function renderViewer(){
  const q = vList[vIdx]; if (!q) return;
  $('#vCount').textContent = `${nf(vIdx + 1)} / ${nf(vList.length)}`;
  $('#vEyebrow').textContent = `${q.year}년 시행 · ${q.year + 1}학년도`;
  $('#vTitle').textContent = `${EXAM_FULL[q.exam]} ${TYPE_NAME[q.type]} ${q.num}번`;
  $('#vTags').innerHTML = `<span class="tag tag-s${q.score}">${q.score}점</span><span class="tag tag-gray">${esc(unitName(q.unit))}</span><span class="tag tag-gray">${isShort(q) ? '단답형' : '5지선다형'}</span>`;
  $('#vImg').src = imgSrc(q); $('#vImg').alt = `${q.year + 1}학년도 ${EXAM_FULL[q.exam]} ${q.num}번 문제`;
  const inB = S.basket.includes(q.id);
  $('#vAdd').innerHTML = inB ? icon('check') + '시험지에 담겨 있어요' : icon('plus') + '시험지에 담기';
  $('#vAdd').classList.toggle('added', inB);
  $('#vFav').classList.toggle('on', !!S.fav[q.id]);
  $('#vFav span').textContent = S.fav[q.id] ? '북마크됨' : '북마크';
  $$('#vStatus button').forEach(b => b.classList.toggle('on', S.status[q.id] === b.dataset.s));
  $('#vDown').href = imgSrc(q);
  $('#vDown').download = `${q.year + 1}학년도 ${EXAM_FULL[q.exam]} ${TYPE_NAME[q.type]} ${q.num}번 (${q.score}점, ${UNITS[q.unit]}).png`;
  $('#vNote').value = S.notes[q.id] || '';
  $('#vPrev').disabled = vIdx <= 0; $('#vNext').disabled = vIdx >= vList.length - 1;
  $('.viewer-stage').scrollTop = 0;
}
$('#vClose').onclick = closeViewer;
$('#viewer').addEventListener('click', e => { if (e.target.id === 'viewer') closeViewer(); });
$('#vPrev').onclick = () => { if (vIdx > 0) { vIdx--; renderViewer(); } };
$('#vNext').onclick = () => { if (vIdx < vList.length - 1) { vIdx++; renderViewer(); } };
$('#vAdd').onclick = () => toggleBasket(vList[vIdx].id);
$('#vFav').onclick = () => toggleFav(vList[vIdx].id);
$('#vStatus').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; const id = vList[vIdx].id;
  if (S.status[id] === b.dataset.s) delete S.status[id]; else S.status[id] = b.dataset.s;
  save(); renderViewer(); refreshCard(id);
};
let noteTimer;
$('#vNote').addEventListener('input', e => {
  const id = vList[vIdx].id, v = e.target.value;
  if (v.trim()) S.notes[id] = v; else delete S.notes[id];
  save(); clearTimeout(noteTimer); noteTimer = setTimeout(() => refreshCard(id), 400);
});
$('#vSame').onclick = () => { const q = vList[vIdx]; closeViewer(); F = F0(); F.units = [q.unit]; showTab('browse'); changed(); };
document.addEventListener('keydown', e => {
  if (vIdx < 0) return;
  if (e.key === 'Escape') return closeViewer();
  if (e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'ArrowLeft') $('#vPrev').click();
  else if (e.key === 'ArrowRight') $('#vNext').click();
  else if (e.key.toLowerCase() === 'a') $('#vAdd').click();
  else if (e.key.toLowerCase() === 'b') $('#vFav').click();
});

/* ================= 시험지 만들기 ================= */
const basketQs = () => S.basket.map(id => byId.get(id)).filter(Boolean);
let bTab = S.prefs.bTab || 'items';
function setBTab(v){
  bTab = v; S.prefs.bTab = v; save();
  $$('#bTabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $$('.bpane').forEach(p => p.classList.toggle('on', p.dataset.pane === v));
  if (v === 'auto') renderAuto();
}
$('#bTabs').onclick = e => { const b = e.target.closest('button'); if (b) setBTab(b.dataset.v); };
document.addEventListener('click', e => { const b = e.target.closest('[data-btab]'); if (b) setBTab(b.dataset.btab); });

function renderBuilder(){
  const qs = basketQs();
  setBTab(bTab);
  const total = qs.reduce((a,q) => a + q.score, 0);
  const n = [2,3,4].map(s => qs.filter(q => q.score === s).length);
  const pages = qs.length ? layoutPages(qs, S.settings).pages.length : 0;
  $('#bDesc').textContent = qs.length ? `${qs.length}문항 · 총 ${total}점으로 A4 시험지를 만들어요.` : '담은 문항으로 A4 시험지를 만들어 인쇄하거나 PDF로 저장해요.';
  $('#bSum').innerHTML = qs.length ? `<div><span>문항</span><b>${qs.length}</b></div><div><span>총점</span><b>${total}</b></div><div><span>문제 쪽수</span><b>${pages}</b></div>
    <div class="bar3" title="2점 ${n[0]} · 3점 ${n[1]} · 4점 ${n[2]}">${n.map((c,i) => c ? `<i style="width:${c/qs.length*100}%;background:var(--s${i+2})"></i>` : '').join('')}</div>` : '';
  $('#bSum').classList.toggle('hidden', !qs.length);
  $('#bListTools').classList.toggle('hidden', !qs.length);
  $('#bEmpty').classList.toggle('hidden', qs.length > 0);
  $('#bList').innerHTML = qs.map((q,i) => `<li class="bitem" draggable="true" data-i="${i}">
      <span class="bgrip" title="끌어서 순서 바꾸기">${icon('grip')}</span>
      <span class="bno">${i + 1}</span>
      <span class="bthumb"><img src="${imgSrc(q)}" alt="" loading="lazy"></span>
      <span class="btext" data-a="view"><span class="t">${esc(qTitle(q))}</span><span class="m"><span class="tag tag-s${q.score}">${q.score}점</span>${esc(unitShort(q.unit))}</span></span>
      <span class="bctrl"><button class="icon-btn" data-a="up" aria-label="위로">${icon('up')}</button><button class="icon-btn" data-a="down" aria-label="아래로">${icon('down')}</button><button class="icon-btn" data-a="del" aria-label="빼기">${icon('x')}</button></span>
    </li>`).join('');
  renderSettings(); renderSaved(); scheduleSheet();
}
$('#bList').addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const i = +b.closest('li').dataset.i, a = b.dataset.a;
  if (a === 'view') return openViewer(i, basketQs());
  if (a === 'del') S.basket.splice(i, 1);
  if (a === 'up' && i > 0) [S.basket[i-1], S.basket[i]] = [S.basket[i], S.basket[i-1]];
  if (a === 'down' && i < S.basket.length - 1) [S.basket[i+1], S.basket[i]] = [S.basket[i], S.basket[i+1]];
  basketChanged();
});
let dragI = -1;
$('#bList').addEventListener('dragstart', e => { const li = e.target.closest('li'); if (!li) return; dragI = +li.dataset.i; li.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; });
$('#bList').addEventListener('dragend', () => $$('#bList li').forEach(l => l.classList.remove('drag','over')));
$('#bList').addEventListener('dragover', e => { e.preventDefault(); const li = e.target.closest('li'); $$('#bList li').forEach(l => l.classList.toggle('over', l === li)); });
$('#bList').addEventListener('drop', e => {
  e.preventDefault(); const li = e.target.closest('li'); if (!li || dragI < 0) return;
  const to = +li.dataset.i; const [m] = S.basket.splice(dragI, 1); S.basket.splice(to, 0, m); dragI = -1; basketChanged();
});
function shuffle(a){ for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i+1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
$('#bSort').onchange = e => {
  const v = e.target.value; e.target.value = ''; if (!v) return;
  const qs = basketQs(), ex = q => EXAM_ORDER[q.exam];
  if (v === 'score') qs.sort((a,b) => a.score - b.score || a.num - b.num);
  if (v === 'unit') qs.sort((a,b) => a.unit - b.unit || a.score - b.score);
  if (v === 'year') qs.sort((a,b) => a.year - b.year || ex(a) - ex(b) || a.num - b.num);
  if (v === 'shuffle') shuffle(qs);
  S.basket = qs.map(q => q.id); basketChanged(); toast('순서를 바꿨어요');
};
$('#bClear').onclick = () => { if (S.basket.length && confirm('담은 문항을 모두 뺄까요?')) { S.basket = []; basketChanged(); changed(); } };

/* 자동 출제 */
function scopeText(){
  const parts = [];
  if (F.exams.length) parts.push(F.exams.map(e => EXAM_FULL[e]).join(', '));
  if (F.yFrom !== Y0 || F.yTo !== Y1) parts.push(`${yShort(F.yFrom)}–${yShort(F.yTo)}`);
  if (F.units.length) parts.push(F.units.length > 3 ? `단원 ${F.units.length}개` : F.units.map(unitShort).join(', '));
  if (F.types.length) parts.push(F.types.map(t => TYPE_NAME[t]).join(', '));
  if (F.forms.length) parts.push(F.forms.map(f => f === 'sa' ? '단답형' : '5지선다형').join(', '));
  if (F.nFrom !== 1 || F.nTo !== 30) parts.push(`${F.nFrom}–${F.nTo}번`);
  if (F.q) parts.push(`“${F.q}”`);
  if (F.mine !== 'all') parts.push({fav:'북마크',x:'틀린 문항',r:'다시 볼 문항',o:'맞은 문항',none:'안 푼 문항',note:'메모한 문항'}[F.mine]);
  return parts.length ? parts.join(' · ') : '전체 문항';
}
function renderAuto(){
  const pool = Q.filter(q => test(q, 'score') && !S.basket.includes(q.id));
  $('#autoScope').innerHTML = `<div class="k"><span>뽑을 범위</span><button class="link" data-tab="browse">조건 바꾸기 ${icon('right')}</button></div><div class="v">${esc(scopeText())} · 뽑을 수 있는 문항 ${nf(pool.length)}개</div>`;
  const a = [2,3,4].map(s => +$('#a' + s).value || 0);
  const pts = a[0]*2 + a[1]*3 + a[2]*4, cnt = a[0] + a[1] + a[2];
  $('#autoTotal').innerHTML = `모두 <b>${cnt}문항 · ${pts}점</b>`;
}
$$('.stepper').forEach(st => st.addEventListener('click', e => {
  const b = e.target.closest('[data-d]'); if (!b) return;
  const inp = st.querySelector('input'); inp.value = Math.max(0, Math.min(40, (+inp.value || 0) + +b.dataset.d)); renderAuto();
}));
$$('.stepper input').forEach(i => i.addEventListener('input', renderAuto));
$('#autoBtn').onclick = () => {
  const pool = Q.filter(q => test(q, 'score') && !S.basket.includes(q.id));
  const want = {2:+$('#a2').value||0, 3:+$('#a3').value||0, 4:+$('#a4').value||0};
  const spread = $('#aSpread').checked, picked = [], short = [];
  [2,3,4].forEach(s => {
    const n = want[s]; if (!n) return;
    const cand = shuffle(pool.filter(q => q.score === s));
    if (spread) {
      const by = new Map(); cand.forEach(q => { if (!by.has(q.unit)) by.set(q.unit, []); by.get(q.unit).push(q); });
      const keys = shuffle([...by.keys()]); let k = 0, got = 0;
      while (got < n && keys.some(u => by.get(u).length)) { const arr = by.get(keys[k++ % keys.length]); if (arr.length) { picked.push(arr.pop()); got++; } }
      if (got < n) short.push(`${s}점 ${n - got}문항`);
    } else { picked.push(...cand.slice(0, n)); if (cand.length < n) short.push(`${s}점 ${n - cand.length}문항`); }
  });
  if (!picked.length) return toast('조건에 맞는 문항이 없어요');
  picked.sort((a,b) => a.score - b.score || a.num - b.num);
  picked.forEach(q => S.basket.push(q.id));
  basketChanged(true); changed(); setBTab('items'); renderBuilder();
  toast(short.length ? `${picked.length}문항을 담았어요 (${short.join(', ')} 부족)` : `${picked.length}문항을 담았어요`);
};

/* settings */
const SW = {renum:'sRenum', labels:'sLabels', source:'sSource', name:'sName', key:'sKey'};
const TX = {title:'sTitle', sub:'sSub', time:'sTime', area:'sArea'};
const SEGS = {style:'sStyle', cols:'sCols', perCol:'sPer', gap:'sGap'};
const PER_HELP = {
  '0':'문항 길이에 맞춰 이어서 배치하고, 남는 곳은 풀이 공간으로 나눠요.',
  '1':'한 단에 한 문항씩 넣어 풀이 공간이 아주 넓어요.',
  '2':'실제 수능처럼 한 단에 2문항씩, 한 쪽에 4문항이 들어가요.',
  '3':'한 단에 3문항씩 넣어요. 긴 문항은 두 칸을 차지해요.',
  '4':'한 단에 4문항씩 촘촘하게 넣어요. 긴 문항은 여러 칸을 차지해요.'
};
function renderSettings(){
  const st = S.settings;
  for (const [k,id] of Object.entries(SW)) document.getElementById(id).checked = !!st[k];
  for (const [k,id] of Object.entries(TX)) { const el = document.getElementById(id); if (document.activeElement !== el) el.value = st[k] || ''; }
  for (const [k,id] of Object.entries(SEGS)) $$('#' + id + ' button').forEach(b => b.classList.toggle('on', b.dataset.v === String(st[k])));
  const csat = st.style === 'csat', auto = String(st.perCol) === '0';
  $$('[data-only]').forEach(el => { const o = el.dataset.only; el.classList.toggle('hidden', (o === 'csat' && !csat) || (o === 'simple' && csat) || (o === 'auto' && !auto)); });
  const per = +st.perCol, cols = +st.cols;
  $('#perHelp').textContent = PER_HELP[String(st.perCol)] + (per ? ` (한 쪽에 최대 ${per * cols}문항)` : '');
}
for (const [k,id] of Object.entries(SW)) document.getElementById(id).onchange = e => { S.settings[k] = e.target.checked; save(); renderBuilder(); };
for (const [k,id] of Object.entries(TX)) document.getElementById(id).oninput = e => { S.settings[k] = e.target.value; save(); scheduleSheet(); };
for (const [k,id] of Object.entries(SEGS)) document.getElementById(id).onclick = e => {
  const b = e.target.closest('button'); if (!b) return; S.settings[k] = b.dataset.v; save(); renderBuilder();
};

/* sheet layout (A4 @ 96dpi = 794 x 1123) */
const PW = 794, PH = 1123;
const GAPS = {s:18, m:70, l:160, xl:280};
const LABEL_H = 40;
const sect = q => isShort(q) ? '단답형' : '5지선다형';
let sheetTimer;
function scheduleSheet(){ clearTimeout(sheetTimer); sheetTimer = setTimeout(renderSheet, 120); }
function geom(st){
  const csat = st.style === 'csat';
  const simpleHead = 112;
  return {csat, padX:44, padT: csat ? 34 : 40, padB: csat ? 22 : 32, foot: csat ? 40 : 32,
    head1: csat ? 118 : simpleHead, headN: csat ? 66 : 0, colGap: csat ? 33 : 29};
}
function layoutPages(qs, st){
  const G = geom(st), cols = +st.cols, innerW = PW - G.padX * 2;
  const colW = cols === 2 ? (innerW - G.colGap) / 2 : innerW;
  const k0 = Math.min(colW / MAXW, cols === 2 ? 1 : 0.62);
  const srcH = st.source ? 16 : 0, per = +st.perCol || 0, gap = GAPS[st.gap] || 70;
  const useLabels = G.csat && st.labels;
  const pages = []; let page = null, col = 0, used = 0;
  const colH = () => PH - G.padT - G.padB - G.foot - (pages.length === 1 ? G.head1 : G.headN);
  const newPage = () => { page = {cols: Array.from({length: cols}, () => [])}; pages.push(page); col = 0; used = 0; };
  const nextCol = () => { col++; used = 0; if (col >= cols) newPage(); };
  newPage();
  qs.forEach((q, i) => {
    const label = useLabels && (i === 0 || sect(qs[i-1]) !== sect(q)) ? sect(q) : null;
    const lh = label ? LABEL_H : 0;
    if (per) {
      const fit = () => {
        const H = colH(), slotH = H / per;
        let k = k0, slots = 1;
        const need = q.h * k0 + srcH + lh;
        if (need > slotH) {
          const k2 = (slotH - srcH - lh - 8) / q.h;
          if (k2 >= k0 * 0.82) k = k2; else slots = Math.ceil(need / slotH);
        }
        if (slots > per) { slots = per; k = Math.min(k0, (H - srcH - lh - 8) / q.h); }
        return {k, slots, slotH};
      };
      let f = fit();
      if (used > 0 && used + f.slots > per) { nextCol(); f = fit(); }
      page.cols[col].push({q, n: i + 1, k: f.k, label, h: f.slots * f.slotH});
      used += f.slots;
    } else {
      let k = k0, h = q.h * k + srcH + lh + gap;
      const full = colH();
      if (q.h * k + srcH + lh > full) { k = (full - srcH - lh - 8) / q.h; h = full; }
      if (used > 0 && used + h > colH() + gap * 0.6) nextCol();
      page.cols[col].push({q, n: i + 1, k, label});
      used += h;
    }
  });
  return {pages};
}
function qBlock(it, st){
  const q = it.q, k = it.k, w = q.w * k, h = q.h * k;
  let num = '';
  if (st.renum) {
    const [x0,y0,x1,y1] = q.nb, bw = (x1 - x0) * k, bh = (y1 - y0) * k, fs = bh * 1.02;
    const est = fs * (0.5 * String(it.n).length + 0.27), sx = Math.min(1, (bw + 2) / est);
    num = `<div class="num" style="left:${x0*k - 1}px;top:${y0*k - 1}px;width:${bw + 2}px;height:${bh + 2}px;font-size:${fs}px"><span style="display:inline-block;transform:scaleX(${sx.toFixed(3)});transform-origin:left center">${it.n}.</span></div>`;
  }
  const style = it.h ? `flex:none;height:${it.h}px` : (st.gap === 's' ? `flex:0 0 auto;margin-bottom:${GAPS.s}px` : '');
  return `<div class="qb" style="${style}">
    ${it.label ? `<div class="c-label">${it.label}</div>` : ''}
    <div class="qimg" style="width:${w}px;height:${h}px"><img src="${imgSrc(q)}" width="${w}" height="${h}" alt="">${num}</div>
    ${st.source ? `<div class="srcline">${esc(srcSheet(q))}</div>` : ''}</div>`;
}
const editAttr = (key, ph) => `data-edit="${key}" data-ph="${ph}" contenteditable="true" spellcheck="false"`;
function csatHead(pn, st){
  const area = esc(st.area || '');
  if (pn === 1) return `<div class="c-head c-first">
      <div class="c-top"><span class="c-name">${st.name ? '성명 <i></i>' : ''}</span><span class="c-sub" ${editAttr('sub','부제목을 입력하세요')}>${esc(st.sub || '')}</span><span class="c-pn">${pn}</span></div>
      <div class="c-row"><span></span><span class="c-area big" ${editAttr('area','제목을 입력하세요')}>${area}</span><span></span></div></div>`;
  const pnEl = `<span class="c-pn">${pn}</span>`;
  return `<div class="c-head"><div class="c-row">${pn % 2 ? '<span></span>' : pnEl}<span class="c-area" data-mirror="area">${area}</span>${pn % 2 ? pnEl : '<span></span>'}</div></div>`;
}
function renderSheet(){
  const qs = basketQs(), st = S.settings, sheet = $('#sheet'), G = geom(st);
  if (!qs.length) { sheet.innerHTML = `<div class="empty">${icon('doc','empty-ic')}<strong>미리보기가 여기에 나타나요</strong><p>문항을 담으면 실제 인쇄될 모습 그대로 보여 드려요.</p></div>`; $('#pageInfo').textContent = ''; return; }
  const {pages} = layoutPages(qs, st);
  const keyRows = st.key ? qs.map((q,i) => ({q, n: i+1})) : [], KEY_PER = 34, keyPages = [];
  for (let i = 0; i < keyRows.length; i += KEY_PER) keyPages.push(keyRows.slice(i, i + KEY_PER));
  const totalPages = pages.length + keyPages.length, total = qs.reduce((a,q) => a + q.score, 0);
  const SRC = '문항 출처: 한국교육과정평가원 · 비영리 학습용';
  const foot = n => G.csat
    ? `<div class="c-foot"><span></span><span class="pbox"><b>${n}</b><b>${totalPages}</b></span><span class="c-src">${SRC}</span></div>`
    : `<div class="p-foot"><span>${SRC}</span><span class="pn">${n} / ${totalPages}</span><span>${esc(st.title || '')}</span></div>`;
  const pad = `padding:${G.padT}px ${G.padX}px ${G.padB}px`;
  let html = '';
  pages.forEach((p, pi) => {
    let head = '';
    if (G.csat) head = csatHead(pi + 1, st);
    else if (pi === 0) head = `<div class="p-head"><div class="t"><div class="sub" ${editAttr('sub','부제목을 입력하세요')}>${esc(st.sub || '')}</div><h1 ${editAttr('title','제목을 입력하세요')}>${esc(st.title || '')}</h1></div>
      <div class="meta">${qs.length}문항 · ${total}점${st.time ? ' · ' + esc(st.time) : ''}${st.name ? '<div class="p-name">성명 <span></span></div>' : ''}</div></div>`;
    html += `<div class="page-holder"><div class="page${G.csat ? ' csat' : ''}${+st.cols === 1 ? ' one' : ''}" style="${pad}">${head}<div class="p-cont">${p.cols.map(c => `<div class="p-col">${c.map(it => qBlock(it, st)).join('')}</div>`).join('')}</div>${foot(pi + 1)}</div></div>`;
  });
  keyPages.forEach((rows, ki) => {
    html += `<div class="page-holder"><div class="page${G.csat ? ' csat' : ''}" style="${pad}"><div class="key-title">문항 정보표${keyPages.length > 1 ? ` (${ki+1}/${keyPages.length})` : ''}</div>
      <table class="keytable"><thead><tr><th style="width:44px">번호</th><th>출처</th><th style="width:150px">단원</th><th style="width:48px">배점</th><th style="width:90px">정답</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${st.renum ? r.n : r.q.num}</td><td class="l">${esc(srcSheet(r.q))}</td><td>${esc(unitShort(r.q.unit))}</td><td>${r.q.score}</td><td></td></tr>`).join('')}
      </tbody></table><div style="flex:1"></div>${foot(pages.length + ki + 1)}</div></div>`;
  });
  sheet.innerHTML = html;
  $('#pageInfo').textContent = `A4 · ${totalPages}쪽`;
  fitZoom();
}
function fitZoom(){ const w = $('.preview').clientWidth - 40; $('#sheet').style.setProperty('--zoom', Math.max(0.3, Math.min(0.9, w / PW)).toFixed(3)); }
addEventListener('resize', () => { if (current === 'builder') fitZoom(); });
$('#printBtn').onclick = async () => {
  if (!S.basket.length) return toast('먼저 문항을 담아 주세요');
  renderSheet();
  await Promise.all($$('#sheet img').map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  const old = document.title; document.title = (S.settings.style === 'csat' ? S.settings.area : S.settings.title) || '시험지';
  window.print(); document.title = old;
};

/* 미리보기에서 제목 · 부제목 바로 고치기 */
const sheetEl = $('#sheet');
sheetEl.addEventListener('input', e => {
  const el = e.target.closest('[data-edit]'); if (!el) return;
  const k = el.dataset.edit, v = el.textContent.replace(/\s*\n\s*/g, ' ');
  if (!el.textContent) el.innerHTML = '';
  S.settings[k] = v; save();
  $$(`#sheet [data-mirror="${k}"], #sheet [data-edit="${k}"]`).forEach(x => { if (x !== el) x.textContent = v; });
  const inp = document.getElementById(TX[k]); if (inp) inp.value = v;
});
sheetEl.addEventListener('keydown', e => { if (e.target.closest('[data-edit]') && e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
sheetEl.addEventListener('paste', e => {
  if (!e.target.closest('[data-edit]')) return;
  e.preventDefault(); const t = (e.clipboardData || window.clipboardData).getData('text').replace(/\s+/g, ' ');
  document.execCommand('insertText', false, t);
});
sheetEl.addEventListener('focusout', e => { if (e.target.closest('[data-edit]')) { S.settings[e.target.dataset.edit] = e.target.textContent.trim(); save(); scheduleSheet(); } });

/* 한글(HWPX) 파일로 저장 */
$('#hwpxBtn').onclick = async () => {
  if (!S.basket.length) return toast('먼저 문항을 담아 주세요');
  const btn = $('#hwpxBtn'), label = btn.innerHTML;
  btn.disabled = true;
  try {
    const qs = basketQs(), st = {...S.settings}, G = geom(st);
    const {pages} = layoutPages(qs, st);
    const blob = await window.makeHwpx({qs, pages, st, G, PW, PH, labelH: LABEL_H, srcH: st.source ? 16 : 0, gaps: GAPS,
      imgSrc, srcSheet, unitShort, onProgress: (i, n) => { btn.innerHTML = `${icon('download')}만드는 중 ${i}/${n}`; }});
    const name = ((st.style === 'csat' ? st.area : st.title) || '시험지').replace(/[\\/:*?"<>|]/g, '').trim() || '시험지';
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name + '.hwpx';
    link.style.display = 'none'; document.body.appendChild(link); link.click();
    setTimeout(() => { URL.revokeObjectURL(link.href); link.parentNode.removeChild(link); }, 4000);
    toast('한글 파일을 내려받았어요');
  } catch (err) {
    console.error(err); alert('한글 파일을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  } finally { btn.disabled = false; btn.innerHTML = label; }
};

/* saved & share */
function renderSaved(){
  $('#savedSets').innerHTML = (S.sets || []).length ? S.sets.map((s, i) => `<li><span class="name"><b>${esc(s.name)}</b><span>${s.ids.length}문항 · ${esc(s.date)}</span></span>
    <button class="btn btn-secondary btn-sm" data-l="${i}">불러오기</button><button class="icon-btn sm" data-d="${i}" aria-label="삭제">${icon('trash')}</button></li>`).join('')
    : `<div class="empty compact">${icon('archive','empty-ic')}<strong>저장한 시험지가 없어요</strong><p>자주 쓰는 구성을 저장해 두면 언제든 다시 불러올 수 있어요.</p></div>`;
}
$('#saveSet').onclick = () => {
  if (!S.basket.length) return toast('담은 문항이 없어요');
  const name = $('#setName').value.trim() || S.settings.title || '시험지';
  const d = new Date(), date = `${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}.`;
  S.sets.unshift({name, ids: [...S.basket], settings: {...S.settings}, date}); $('#setName').value = '';
  save(); renderSaved(); toast('보관함에 저장했어요');
};
$('#savedSets').addEventListener('click', e => {
  const l = e.target.closest('[data-l]'), d = e.target.closest('[data-d]');
  if (l) { const s = S.sets[+l.dataset.l]; if (S.basket.length && !confirm('지금 담은 문항을 이 시험지로 바꿀까요?')) return;
    S.basket = s.ids.filter(id => byId.has(id)); S.settings = Object.assign({...DEF_SETTINGS}, s.settings); basketChanged(); changed(); setBTab('items'); renderBuilder(); toast('시험지를 불러왔어요'); }
  if (d && confirm('저장한 시험지를 삭제할까요?')) { S.sets.splice(+d.dataset.d, 1); save(); renderSaved(); }
});
const enc = id => { const [y,e,t,n] = id.split('-'); return `${y.slice(2)}${e}${t}${n}`; };
const dec = s => { const m = s.match(/^(\d\d)([S69])([a-zA-Z]+)(\d\d)$/); return m ? `20${m[1]}-${m[2]}-${m[3]}-${m[4]}` : null; };
$('#shareSet').onclick = async () => {
  if (!S.basket.length) return toast('담은 문항이 없어요');
  const url = location.origin + location.pathname + '#set=' + S.basket.map(enc).join('.') + '&t=' + encodeURIComponent(S.settings.title || '');
  try { await navigator.clipboard.writeText(url); toast('공유 링크를 복사했어요'); } catch(e) { prompt('아래 링크를 복사하세요', url); }
};
function readHash(){
  const h = new URLSearchParams(location.hash.slice(1)), set = h.get('set'); if (!set) return;
  const ids = set.split('.').map(dec).filter(id => id && byId.has(id));
  history.replaceState(null, '', location.pathname);
  if (!ids.length) return;
  if (S.basket.length && !confirm(`공유받은 시험지(${ids.length}문항)를 불러올까요? 지금 담은 문항은 바뀌어요.`)) return;
  S.basket = ids; const t = h.get('t'); if (t) S.settings.title = t;
  basketChanged(); bTab = 'items'; showTab('builder'); toast(`공유받은 시험지 ${ids.length}문항을 불러왔어요`);
}

/* ================= 출제 경향 ================= */
let stExam = 'all', stScore = 'all';
function segBind(sel, get, set){
  const sync = () => $$(sel + ' button').forEach(b => b.classList.toggle('on', b.dataset.v === get()));
  $(sel).onclick = e => { const b = e.target.closest('button'); if (!b) return; set(b.dataset.v); sync(); renderStats(); };
  sync();
}
segBind('#stExam', () => stExam, v => stExam = v);
segBind('#stScore', () => stScore, v => stScore = v);
function renderStats(){
  const pool = Q.filter(q => (stExam === 'all' || (stExam === 'mock' ? q.exam > 0 : q.exam === 0)) && (stScore === 'all' || q.score === +stScore));
  const cnt = new Map(); let max = 1;
  pool.forEach(q => { const k = q.unit + '_' + q.year; cnt.set(k, (cnt.get(k)||0) + 1); });
  cnt.forEach(v => max = Math.max(max, v));
  const lvl = v => Math.min(5, Math.max(1, Math.ceil(v / max * 5)));
  const cols = YEARS.length + 2;
  let h = `<table class="heat"><thead><tr><th></th>${YEARS.map(y => `<th>${yearMode() === 'hak' ? `’${String(y+1).slice(2)}` : y}</th>`).join('')}<th>합계</th></tr></thead><tbody>`;
  let first = true;
  UNIT_GROUPS.forEach(g => {
    const us = g.units.filter(u => pool.some(q => q.unit === u)); if (!us.length) return;
    if (!first && !(g.units.length > 1)) h += `<tr class="sp"><td colspan="${cols}"></td></tr>`;
    first = false;
    if (g.units.length > 1) h += `<tr><th class="g" colspan="${cols}">${esc(g.name)}</th></tr>`;
    us.forEach(u => {
      let sum = 0;
      h += `<tr><th class="u">${esc(g.units.length > 1 ? unitName(u) : g.name)}</th>` + YEARS.map(y => {
        const v = cnt.get(u + '_' + y) || 0; sum += v;
        return v ? `<td class="h${lvl(v)}" data-u="${u}" data-y="${y}" title="${yLabel(y)} · ${esc(unitName(u))} · ${v}문항">${v}</td>` : `<td class="z"></td>`;
      }).join('') + `<td class="sum">${sum}</td></tr>`;
    });
  });
  $('#heat').innerHTML = h + '</tbody></table>';
  $('#legend').innerHTML = `적음 ${[1,2,3,4,5].map(i => `<i class="h${i}"></i>`).join('')} 많음`;
  $$('#heat td[data-u]').forEach(td => td.onclick = () => {
    F = F0(); F.units = [+td.dataset.u]; F.yFrom = F.yTo = +td.dataset.y;
    if (stExam === '0') F.exams = [0]; if (stExam === 'mock') F.exams = [1,2];
    if (stScore === '4') F.scores = [4];
    showTab('browse'); changed();
  });
  const gc = new Map(); pool.forEach(q => { const gi = groupOfUnit(q.unit); gc.set(gi, (gc.get(gi)||0) + 1); });
  const top = [...gc].sort((a,b) => b[1] - a[1]);
  const papers = new Set(pool.map(q => q.year + '-' + q.exam + '-' + (q.type < 4 ? q.type : 'n'))).size;
  const recent = pool.filter(q => q.year >= Y1 - 2); const rc = new Map(); recent.forEach(q => { const gi = groupOfUnit(q.unit); rc.set(gi, (rc.get(gi)||0) + 1); });
  const rtop = [...rc].sort((a,b) => b[1] - a[1])[0];
  $('#statCards').innerHTML = [
    ['문항', nf(pool.length), '개', `시험지 ${papers}회분`],
    ['가장 많이 나온 단원', top[0] ? UNIT_GROUPS[top[0][0]].name : '-', '', top[0] ? `${top[0][1]}문항 · ${Math.round(top[0][1]/pool.length*100)}%` : ''],
    ['그다음', top[1] ? UNIT_GROUPS[top[1][0]].name : '-', '', top[1] ? `${top[1][1]}문항 · ${Math.round(top[1][1]/pool.length*100)}%` : ''],
    ['최근 3년 최다 단원', rtop ? UNIT_GROUPS[rtop[0]].name : '-', '', rtop ? `${Y1-2}–${Y1}년 ${rtop[1]}문항` : ''],
  ].map(([k,v,u,s]) => `<div class="kpi"><div class="k">${k}</div><div class="v">${esc(v)}${u ? `<small>${u}</small>` : ''}</div><div class="s">${esc(s)}</div></div>`).join('');
}

/* ================= 학습 기록 ================= */
function renderMe(){
  const st = Object.entries(S.status).filter(([id]) => byId.has(id));
  const c = s => st.filter(x => x[1] === s).length;
  const o = c('o'), x = c('x'), r = c('r'), graded = o + x;
  $('#meCards').innerHTML = [
    ['표시한 문항', st.length, '개', `맞음 ${o} · 틀림 ${x} · 다시 보기 ${r}`],
    ['정답률', graded ? Math.round(o / graded * 100) : '-', graded ? '%' : '', graded ? `맞음·틀림 표시 ${graded}문항 기준` : '맞음·틀림을 표시해 보세요'],
    ['복습할 문항', x + r, '개', '틀림 + 다시 보기'],
    ['북마크', Object.keys(S.fav).filter(id => byId.has(id)).length, '개', `메모 ${Object.keys(S.notes).length}개`],
  ].map(([k,v,u,s]) => `<div class="kpi"><div class="k">${k}</div><div class="v">${v}${u ? `<small>${u}</small>` : ''}</div><div class="s">${esc(s)}</div></div>`).join('');
  const rows = UNIT_GROUPS.map((g, gi) => {
    const ids = st.filter(([id]) => groupOfUnit(byId.get(id).unit) === gi);
    return {g, gi, n: ids.length, o: ids.filter(v => v[1] === 'o').length, x: ids.filter(v => v[1] === 'x').length, r: ids.filter(v => v[1] === 'r').length};
  }).filter(v => v.n);
  $('#meTable').innerHTML = rows.length ? rows.map(v => `<div class="urow">
      <div><div class="n">${esc(v.g.name)}</div><div class="c">${v.n}문항 · 맞음 ${v.o} · 틀림 ${v.x}${v.r ? ` · 다시 보기 ${v.r}` : ''}</div></div>
      <div class="sbar"><i style="width:${v.o/v.n*100}%;background:var(--green)"></i><i style="width:${v.x/v.n*100}%;background:var(--red)"></i><i style="width:${v.r/v.n*100}%;background:var(--orange)"></i></div>
      ${v.x + v.r ? `<button class="link" data-g="${v.gi}">복습 ${icon('right')}</button>` : '<span></span>'}</div>`).join('')
    : `<div class="empty compact">${icon('activity','empty-ic')}<strong>아직 기록이 없어요</strong><p>문항을 열고 맞음 · 틀림 · 다시 보기를 눌러 보세요.</p><button class="btn btn-secondary" data-tab="browse">문제 풀러 가기</button></div>`;
  $$('#meTable [data-g]').forEach(b => b.onclick = () => {
    const g = UNIT_GROUPS[+b.dataset.g]; F = F0(); F.units = [...g.units];
    F.mine = Q.some(q => g.units.includes(q.unit) && S.status[q.id] === 'x') ? 'x' : 'r';
    showTab('browse'); changed();
  });
  const notes = Object.entries(S.notes).filter(([id]) => byId.has(id));
  $('#meNotes').innerHTML = notes.length ? notes.map(([id, t]) => { const q = byId.get(id);
    return `<div class="note" data-id="${id}"><div class="t">${esc(qTitle(q))} <span class="tag tag-s${q.score}">${q.score}점</span></div><div class="b">${esc(t)}</div></div>`; }).join('')
    : `<div class="empty compact">${icon('pencil','empty-ic')}<strong>메모가 없어요</strong><p>문항을 열어 풀이 아이디어를 적어 두면 여기에 모여요.</p></div>`;
  $$('#meNotes .note').forEach(n => n.onclick = () => { const list = notes.map(([id]) => byId.get(id)); openViewer(list.findIndex(q => q.id === n.dataset.id), list); });
}
$('#exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(S, null, 1)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  const d = new Date(); a.download = `문제은행-기록-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('기록 파일을 내려받았어요');
};
$('#importFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const obj = JSON.parse(await f.text());
    if (!obj || typeof obj !== 'object' || !('basket' in obj)) throw 0;
    if (!confirm('백업 파일로 지금 기록을 바꿀까요?')) return;
    S = Object.assign({basket:[], fav:{}, status:{}, notes:{}, sets:[], settings:{...DEF_SETTINGS}, prefs:{}}, obj);
    S.basket = S.basket.filter(id => byId.has(id)); save(); basketChanged(); renderMe(); changed(); toast('기록을 불러왔어요');
  } catch(err) { alert('백업 파일을 읽지 못했어요.'); }
  e.target.value = '';
};
$('#wipeBtn').onclick = () => {
  if (!confirm('맞음 · 틀림 표시, 북마크, 메모를 모두 지울까요? 담은 문항과 보관함은 남아요.')) return;
  S.status = {}; S.fav = {}; S.notes = {}; save(); renderMe(); changed(); toast('기록을 지웠어요');
};

/* ---------------- start ---------------- */
$('#totalCount').textContent = nf(Q.length);
basketChanged();
changed();
showTab(S.prefs.tab || 'browse');
readHash();
addEventListener('hashchange', readHash);
})();
