(function(){
'use strict';
const D = window.QB;
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------------- data ---------------- */
const EXAM_CODE = ['S','6','9'];
const EXAM_NAME = D.exams;                 // 수능, 6월 모평, 9월 모평
const EXAM_ORDER = [2,0,1];                // 같은 해 안에서 시행 순서: 6월 → 9월 → 수능
const TYPE_CODE = ['A','B','ga','na','c','pr','ca','ge'];
const Q = D.rows.map((r,i) => ({
  i, id:r[0], exam:r[1], year:r[2], type:r[3], num:r[4], score:r[5], unit:r[6],
  w:r[7], h:r[8], nb:[r[9],r[10],r[11],r[12]], text:r[13]
}));
const byId = new Map(Q.map(q => [q.id, q]));
const YEARS = [...new Set(Q.map(q=>q.year))].sort((a,b)=>a-b);
const MAXW = Math.max(...Q.map(q=>q.w));
const UNITS = D.units;
const UNIT_GROUPS = [
  ['지수·로그', ['지수와로그','지수함수와로그함수']],
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
  ['행렬 (구 교육과정)', ['행렬','행렬과그래프','일차변환과행렬']],
  ['집합·함수·방정식', ['집합과명제','함수','방정식과부등식']],
].map(([name, us]) => ({name, units: us.map(u => UNITS.indexOf(u))}));
const UNIT_LABEL = {
  '지수와로그':'지수와 로그','지수함수와로그함수':'지수함수와 로그함수','수열의극한':'수열의 극한',
  '함수의극한과연속':'함수의 극한과 연속','순열과조합':'순열과 조합','경우의수':'경우의 수',
  '평면벡터':'평면벡터','공간벡터':'공간벡터','공간도형과공간좌표':'공간도형과 공간좌표',
  '행렬과그래프':'행렬과 그래프','일차변환과행렬':'일차변환과 행렬','집합과명제':'집합과 명제',
  '방정식과부등식':'방정식과 부등식'
};
const unitName = u => UNIT_LABEL[UNITS[u]] || UNITS[u];
const groupOfUnit = u => UNIT_GROUPS.findIndex(g => g.units.includes(u));
const TYPE_GROUPS = [
  ['2013–2015 · A/B형', [0,1]],
  ['2016–2020 · 가/나형', [2,3]],
  ['2021– · 공통 + 선택', [4,5,6,7]],
];
const isShort = q => q.year <= 2020 ? q.num >= 22 : (q.type === 4 ? q.num >= 16 : q.num >= 29);
const imgSrc = q => `img/${q.year}/${q.id}.png`;

/* ---------------- storage ---------------- */
const KEY = 'qbank.v1';
const DEF_SETTINGS = {title:'수학 영역 실전 모의고사', sub:'', time:'', cols:'2', gap:'m', renum:true, source:true, name:true, key:true};
let S = {basket:[], fav:{}, status:{}, notes:{}, sets:[], settings:{...DEF_SETTINGS}, prefs:{}};
try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(S, JSON.parse(raw)); } catch(e) {}
S.settings = Object.assign({...DEF_SETTINGS}, S.settings || {});
S.basket = (S.basket || []).filter(id => byId.has(id));
let saveTimer = null;
function save(){ clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e) {} }, 150); }

/* ---------------- labels ---------------- */
const yearMode = () => S.prefs.yearMode || 'exam';
const yLabel = y => yearMode() === 'hak' ? `${y+1}학년도` : `${y}`;
const typeLabel = t => D.types[t];
function srcShort(q){ return `${yLabel(q.year)} ${EXAM_NAME[q.exam]} · ${typeLabel(q.type)} ${q.num}번`; }
function srcFull(q){ return `${q.year}년 시행(${q.year+1}학년도) ${EXAM_NAME[q.exam]==='수능'?'대학수학능력시험':EXAM_NAME[q.exam].replace('모평','모의평가')} ${typeLabel(q.type)} ${q.num}번`; }
function srcSheet(q){ return `${q.year+1}학년도 ${EXAM_NAME[q.exam].replace('모평','모의평가')} ${typeLabel(q.type)} ${q.num}번`; }

function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1800); }

/* ---------------- theme ---------------- */
function applyTheme(){
  if (S.prefs.theme) document.documentElement.setAttribute('data-theme', S.prefs.theme);
  else document.documentElement.removeAttribute('data-theme');
}
applyTheme();
$('#themeBtn').onclick = () => {
  const cur = S.prefs.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  S.prefs.theme = cur === 'dark' ? 'light' : 'dark'; applyTheme(); save();
};

/* ---------------- tabs ---------------- */
function showTab(name){
  $$('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
  S.prefs.tab = name; save();
  if (name === 'builder') renderBuilder();
  if (name === 'stats') renderStats();
  if (name === 'me') renderMe();
  window.scrollTo(0, 0);
}
$$('.tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));

/* ================= 문제 찾기 ================= */
const F0 = () => ({q:'', exams:[], yFrom:YEARS[0], yTo:YEARS[YEARS.length-1], scores:[], forms:[], types:[], units:[], nFrom:1, nTo:30, mine:'all'});
let F = Object.assign(F0(), S.prefs.filters || {});
let sortMode = S.prefs.sort || 'new';
let shuffleKey = new Map();

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
    if (F.mine === 'x' && st !== 'x') return false;
    if (F.mine === 'o' && st !== 'o') return false;
    if (F.mine === 'r' && st !== 'r') return false;
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

/* -- build filter controls once -- */
function chip(label, on, onclick, n){
  const b = document.createElement('button');
  b.className = 'chip' + (on ? ' on' : '');
  b.innerHTML = esc(label) + (n !== undefined ? ` <span class="n">${n}</span>` : '');
  b.onclick = onclick; return b;
}
function toggleIn(arr, v){ const i = arr.indexOf(v); if (i >= 0) arr.splice(i,1); else arr.push(v); }

function renderFilters(){
  // exam
  const ce = countBy('exam', q => q.exam), fe = $('#f-exam'); fe.innerHTML = '';
  EXAM_NAME.forEach((n,i) => fe.appendChild(chip(n, F.exams.includes(i), () => { toggleIn(F.exams, i); changed(); }, ce.get(i)||0)));
  // year
  const yf = $('#yearFrom'), yt = $('#yearTo');
  const opts = YEARS.map(y => `<option value="${y}">${yLabel(y)}</option>`).join('');
  yf.innerHTML = opts; yt.innerHTML = opts; yf.value = F.yFrom; yt.value = F.yTo;
  $('#yearMode').value = yearMode();
  const yq = $('#yearQuick'); yq.innerHTML = '';
  const last = YEARS[YEARS.length-1];
  [['전체', YEARS[0], last], ['최근 3년', last-2, last], ['최근 5년', last-4, last], ['2021– 현 체제', 2021, last]].forEach(([n,a,b]) =>
    yq.appendChild(chip(n, F.yFrom === a && F.yTo === b, () => { F.yFrom = a; F.yTo = b; changed(); })));
  // score
  const cs = countBy('score', q => q.score), fs = $('#f-score'); fs.innerHTML = '';
  [2,3,4].forEach(s => fs.appendChild(chip(s + '점', F.scores.includes(s), () => { toggleIn(F.scores, s); changed(); }, cs.get(s)||0)));
  // form
  const cf = countBy('form', q => isShort(q) ? 'sa' : 'mc'), ff = $('#f-form'); ff.innerHTML = '';
  [['mc','5지선다형'],['sa','단답형']].forEach(([k,n]) => ff.appendChild(chip(n, F.forms.includes(k), () => { toggleIn(F.forms, k); changed(); }, cf.get(k)||0)));
  // type
  const ct = countBy('type', q => q.type), ft = $('#f-type'); ft.innerHTML = '';
  TYPE_GROUPS.forEach(([label, ts]) => {
    const g = document.createElement('div'); g.className = 'tgroup';
    g.innerHTML = `<div class="tlabel">${esc(label)}</div>`;
    const c = document.createElement('div'); c.className = 'chips';
    ts.forEach(t => c.appendChild(chip(D.types[t], F.types.includes(t), () => { toggleIn(F.types, t); changed(); }, ct.get(t)||0)));
    g.appendChild(c); ft.appendChild(g);
  });
  // units
  const cu = countBy('unit', q => q.unit), fu = $('#f-unit');
  const openSet = new Set($$('#f-unit .ugroup.open').map(e => +e.dataset.g));
  if (!fu.dataset.init) { F.units.forEach(u => openSet.add(groupOfUnit(u))); fu.dataset.init = 1; }
  fu.innerHTML = '';
  UNIT_GROUPS.forEach((g, gi) => {
    const total = g.units.reduce((a,u) => a + (cu.get(u)||0), 0);
    const sel = g.units.filter(u => F.units.includes(u)).length;
    const el = document.createElement('div');
    el.className = 'ugroup' + (openSet.has(gi) ? ' open' : ''); el.dataset.g = gi;
    const single = g.units.length === 1;
    el.innerHTML = `<div class="ugroup-head"><input type="checkbox" ${sel === g.units.length ? 'checked' : ''}>
      <span>${esc(g.name)}</span><span class="n">${total}</span>${single ? '' : '<span class="caret">▶</span>'}</div>` +
      (single ? '' : `<div class="ugroup-body">${g.units.map(u =>
        `<label><input type="checkbox" data-u="${u}" ${F.units.includes(u) ? 'checked' : ''}>${esc(unitName(u))}<span class="n">${cu.get(u)||0}</span></label>`).join('')}</div>`);
    const cb = el.querySelector('.ugroup-head input');
    cb.indeterminate = sel > 0 && sel < g.units.length;
    cb.onclick = e => {
      e.stopPropagation();
      if (sel === g.units.length) F.units = F.units.filter(u => !g.units.includes(u));
      else g.units.forEach(u => { if (!F.units.includes(u)) F.units.push(u); });
      changed();
    };
    el.querySelector('.ugroup-head').onclick = () => { if (single) cb.click(); else el.classList.toggle('open'); };
    el.querySelectorAll('.ugroup-body input').forEach(i => i.onchange = () => { toggleIn(F.units, +i.dataset.u); changed(); });
    fu.appendChild(el);
  });
  // num
  $('#numFrom').value = F.nFrom; $('#numTo').value = F.nTo;
  // mine
  const fm = $('#f-mine'); fm.innerHTML = '';
  [['all','전체'],['fav','★ 즐겨찾기'],['x','❌ 틀림'],['r','🔁 다시 보기'],['o','⭕ 맞음'],['none','안 푼 문항'],['note','📝 메모']].forEach(([k,n]) =>
    fm.appendChild(chip(n, F.mine === k, () => { F.mine = k; changed(); })));
  $('#q').value = F.q;
  renderActive();
}

function renderActive(){
  const box = $('#activeFilters'); box.innerHTML = '';
  const add = (label, fn) => { const c = chip(label + ' ✕', false, () => { fn(); changed(); }); box.appendChild(c); };
  if (F.q) add(`“${F.q}”`, () => F.q = '');
  F.exams.forEach(e => add(EXAM_NAME[e], () => toggleIn(F.exams, e)));
  if (F.yFrom !== YEARS[0] || F.yTo !== YEARS[YEARS.length-1]) add(`${yLabel(F.yFrom)} ~ ${yLabel(F.yTo)}`, () => { F.yFrom = YEARS[0]; F.yTo = YEARS[YEARS.length-1]; });
  F.scores.forEach(s => add(s + '점', () => toggleIn(F.scores, s)));
  F.forms.forEach(f => add(f === 'sa' ? '단답형' : '5지선다형', () => toggleIn(F.forms, f)));
  F.types.forEach(t => add(D.types[t], () => toggleIn(F.types, t)));
  F.units.forEach(u => add(unitName(u), () => toggleIn(F.units, u)));
  if (F.nFrom !== 1 || F.nTo !== 30) add(`${F.nFrom}~${F.nTo}번`, () => { F.nFrom = 1; F.nTo = 30; });
  if (F.mine !== 'all') add({fav:'즐겨찾기',x:'틀린 문항',r:'다시 볼 문항',o:'맞은 문항',none:'안 푼 문항',note:'메모 있는 문항'}[F.mine], () => F.mine = 'all');
}

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
  renderFilters();
  results = sortList(Q.filter(q => test(q)));
  $('#resultCount').textContent = results.length.toLocaleString();
  $('#empty').classList.toggle('hidden', results.length > 0);
  $('#grid').innerHTML = ''; shown = 0; renderMore();
}
function cardHTML(q){
  const st = S.status[q.id];
  const inB = S.basket.includes(q.id);
  return `<div class="card${inB ? ' in' : ''}" data-id="${q.id}">
    <div class="card-head"><span class="src">${esc(srcShort(q))}</span>
      <span class="badge s${q.score}">${q.score}점</span><span class="unit-tag">${esc(unitName(q.unit))}</span>
      <span class="status-dot">${st === 'o' ? '⭕' : st === 'x' ? '❌' : st === 'r' ? '🔁' : ''}${S.notes[q.id] ? '📝' : ''}</span></div>
    <div class="thumb${q.h / q.w > 0.75 ? ' clip' : ''}" data-act="open"><img loading="lazy" src="${imgSrc(q)}" alt="${esc(srcShort(q))}" width="${q.w}" height="${q.h}"></div>
    <div class="card-foot">
      <button class="btn add" data-act="add">${inB ? '✓ 담김' : '＋ 담기'}</button>
      <button class="btn fav-btn${S.fav[q.id] ? ' on' : ''}" data-act="fav" title="즐겨찾기">★</button>
      <button class="btn" data-act="open" title="크게 보기">⤢</button>
    </div></div>`;
}
function renderMore(){
  const slice = results.slice(shown, shown + PAGE);
  $('#grid').insertAdjacentHTML('beforeend', slice.map(cardHTML).join(''));
  shown += slice.length;
  $('#more').innerHTML = shown < results.length ? `<button class="btn" id="moreBtn">더 보기 (${(results.length - shown).toLocaleString()}문항 남음)</button>` : '';
  const mb = $('#moreBtn'); if (mb) mb.onclick = renderMore;
}
const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && shown < results.length && $('#tab-browse').classList.contains('active')) renderMore(); }, {rootMargin:'600px'});
io.observe($('#more'));

$('#grid').addEventListener('click', e => {
  const act = e.target.closest('[data-act]'); if (!act) return;
  const card = e.target.closest('.card'); const id = card.dataset.id;
  if (act.dataset.act === 'add') toggleBasket(id);
  else if (act.dataset.act === 'fav') toggleFav(id);
  else if (act.dataset.act === 'open') openModal(results.findIndex(q => q.id === id));
});
function refreshCard(id){
  const c = document.querySelector(`.card[data-id="${id}"]`);
  if (c) c.outerHTML = cardHTML(byId.get(id));
}

/* filter inputs */
let qTimer;
$('#q').addEventListener('input', e => { clearTimeout(qTimer); qTimer = setTimeout(() => { F.q = e.target.value.trim(); changed(); }, 250); });
$('#yearFrom').onchange = e => { F.yFrom = +e.target.value; if (F.yFrom > F.yTo) F.yTo = F.yFrom; changed(); };
$('#yearTo').onchange = e => { F.yTo = +e.target.value; if (F.yTo < F.yFrom) F.yFrom = F.yTo; changed(); };
$('#yearMode').onchange = e => { S.prefs.yearMode = e.target.value; save(); changed(); };
$('#numFrom').onchange = e => { F.nFrom = Math.max(1, Math.min(30, +e.target.value || 1)); changed(); };
$('#numTo').onchange = e => { F.nTo = Math.max(1, Math.min(30, +e.target.value || 30)); changed(); };
$('#resetFilters').onclick = () => { F = F0(); changed(); };
$('#sort').value = sortMode;
$('#sort').onchange = e => {
  sortMode = e.target.value; S.prefs.sort = sortMode; save();
  if (sortMode === 'random') { shuffleKey = new Map(Q.map(q => [q.id, Math.random()])); }
  changed();
};
if (sortMode === 'random') shuffleKey = new Map(Q.map(q => [q.id, Math.random()]));
$$('#sizeSeg button').forEach(b => {
  b.classList.toggle('active', b.dataset.size === (S.prefs.size || 'm'));
  b.onclick = () => {
    S.prefs.size = b.dataset.size; save();
    $$('#sizeSeg button').forEach(x => x.classList.toggle('active', x === b));
    $('#grid').className = 'grid size-' + b.dataset.size;
  };
});
$('#grid').className = 'grid size-' + (S.prefs.size || 'm');
$('#addAllBtn').onclick = () => {
  const add = results.filter(q => !S.basket.includes(q.id));
  if (!add.length) return toast('이미 모두 담겨 있습니다');
  if (add.length > 60 && !confirm(`${add.length}문항을 모두 담을까요?`)) return;
  add.forEach(q => S.basket.push(q.id)); basketChanged(); changed();
  toast(`${add.length}문항을 담았습니다`);
};
$('#openFilters').onclick = () => $('#filters').classList.add('open');
$('#closeFilters').onclick = () => $('#filters').classList.remove('open');

/* basket & fav */
function toggleBasket(id){
  const i = S.basket.indexOf(id);
  if (i >= 0) { S.basket.splice(i, 1); toast('시험지에서 뺐습니다'); }
  else { S.basket.push(id); toast(`시험지에 담았습니다 (${S.basket.length}문항)`); }
  basketChanged(); refreshCard(id); if (modalIdx >= 0) renderModal();
}
function toggleFav(id){
  if (S.fav[id]) delete S.fav[id]; else S.fav[id] = 1;
  save(); refreshCard(id); if (modalIdx >= 0) renderModal();
}
function basketChanged(){
  $('#basketCount').textContent = S.basket.length; save();
  if ($('#tab-builder').classList.contains('active')) renderBuilder();
}

/* ---------------- modal ---------------- */
let modalIdx = -1, modalList = null;
function openModal(i, list){ modalList = list || results; modalIdx = i; if (i < 0) return; renderModal(); $('#modal').classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closeModal(){ $('#modal').classList.add('hidden'); modalIdx = -1; document.body.style.overflow = ''; }
function renderModal(){
  const q = modalList[modalIdx]; if (!q) return;
  $('#mTitle').innerHTML = `<span>${esc(srcFull(q))}</span><span class="badge s${q.score}">${q.score}점</span><span class="unit-tag">${esc(unitName(q.unit))}</span><span class="muted small">${modalIdx + 1} / ${modalList.length}</span>`;
  $('#mImg').src = imgSrc(q); $('#mImg').alt = srcFull(q);
  const inB = S.basket.includes(q.id);
  $('#mAdd').textContent = inB ? '✓ 시험지에 담김 (빼기)' : '＋ 시험지에 담기';
  $('#mFav').textContent = S.fav[q.id] ? '★ 즐겨찾기됨' : '☆ 즐겨찾기';
  $('#mFav').classList.toggle('on', !!S.fav[q.id]);
  $$('#mStatus button').forEach(b => b.classList.toggle('on', S.status[q.id] === b.dataset.s));
  $('#mDown').href = imgSrc(q);
  $('#mDown').download = `${q.year}년 ${EXAM_NAME[q.exam]} ${typeLabel(q.type)} ${String(q.num).padStart(2,'0')}번 (${q.score}점, ${UNITS[q.unit]}).png`;
  $('#mNote').value = S.notes[q.id] || '';
  $('#mPrev').disabled = modalIdx <= 0; $('#mNext').disabled = modalIdx >= modalList.length - 1;
}
$('#mClose').onclick = closeModal;
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
$('#mPrev').onclick = () => { if (modalIdx > 0) { modalIdx--; renderModal(); } };
$('#mNext').onclick = () => { if (modalIdx < modalList.length - 1) { modalIdx++; renderModal(); } };
$('#mAdd').onclick = () => toggleBasket(modalList[modalIdx].id);
$('#mFav').onclick = () => toggleFav(modalList[modalIdx].id);
$$('#mStatus button').forEach(b => b.onclick = () => {
  const id = modalList[modalIdx].id;
  if (S.status[id] === b.dataset.s) delete S.status[id]; else S.status[id] = b.dataset.s;
  save(); renderModal(); refreshCard(id);
});
$('#mNote').addEventListener('input', e => {
  const id = modalList[modalIdx].id; const v = e.target.value;
  if (v.trim()) S.notes[id] = v; else delete S.notes[id];
  save(); clearTimeout(qTimer); qTimer = setTimeout(() => refreshCard(id), 400);
});
$('#mSame').onclick = () => {
  const q = modalList[modalIdx]; closeModal();
  F = F0(); F.units = [q.unit]; showTab('browse'); changed();
};
document.addEventListener('keydown', e => {
  if (modalIdx < 0 || e.target.tagName === 'TEXTAREA') { if (e.key === 'Escape' && modalIdx >= 0) closeModal(); return; }
  if (e.key === 'Escape') closeModal();
  else if (e.key === 'ArrowLeft') $('#mPrev').click();
  else if (e.key === 'ArrowRight') $('#mNext').click();
  else if (e.key === 'a' || e.key === 'A') $('#mAdd').click();
});

/* ================= 시험지 만들기 ================= */
function basketQs(){ return S.basket.map(id => byId.get(id)).filter(Boolean); }
function renderBuilder(){
  const qs = basketQs();
  $('#bEmpty').classList.toggle('hidden', qs.length > 0);
  const total = qs.reduce((a,q) => a + q.score, 0);
  $('#bSummary').textContent = qs.length ? `${qs.length}문항 · 총 ${total}점` : '';
  const sc = [2,3,4].map(s => [s, qs.filter(q => q.score === s).length]).filter(x => x[1]);
  const gc = new Map(); qs.forEach(q => { const g = UNIT_GROUPS[groupOfUnit(q.unit)].name; gc.set(g, (gc.get(g)||0) + 1); });
  $('#bDist').innerHTML = sc.map(([s,n]) => `<span>${s}점 ${n}</span>`).join('') + [...gc].map(([g,n]) => `<span>${esc(g)} ${n}</span>`).join('');
  $('#bList').innerHTML = qs.map((q,i) => `<li draggable="true" data-i="${i}">
      <span class="no">${i+1}</span>
      <span class="bthumb"><img src="${imgSrc(q)}" alt="" loading="lazy"></span>
      <span class="meta">${esc(srcShort(q))} <span class="badge s${q.score}">${q.score}점</span><br><span class="u">${esc(unitName(q.unit))}</span></span>
      <span class="ctrl"><button data-a="view" title="크게 보기">⤢</button><button data-a="up" title="위로">▲</button><button data-a="down" title="아래로">▼</button><button data-a="del" title="빼기">✕</button></span>
    </li>`).join('');
  renderSettings(); renderSaved(); scheduleSheet();
}
$('#bList').addEventListener('click', e => {
  const b = e.target.closest('button[data-a]'); if (!b) return;
  const i = +b.closest('li').dataset.i, a = b.dataset.a;
  if (a === 'view') return openModal(i, basketQs());
  if (a === 'del') S.basket.splice(i, 1);
  if (a === 'up' && i > 0) [S.basket[i-1], S.basket[i]] = [S.basket[i], S.basket[i-1]];
  if (a === 'down' && i < S.basket.length - 1) [S.basket[i+1], S.basket[i]] = [S.basket[i], S.basket[i+1]];
  basketChanged(); renderBuilder();
});
let dragI = -1;
$('#bList').addEventListener('dragstart', e => { const li = e.target.closest('li'); if (!li) return; dragI = +li.dataset.i; li.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; });
$('#bList').addEventListener('dragend', e => { $$('#bList li').forEach(l => l.classList.remove('drag','over')); });
$('#bList').addEventListener('dragover', e => { e.preventDefault(); const li = e.target.closest('li'); $$('#bList li').forEach(l => l.classList.toggle('over', l === li)); });
$('#bList').addEventListener('drop', e => {
  e.preventDefault(); const li = e.target.closest('li'); if (!li || dragI < 0) return;
  const to = +li.dataset.i; const [m] = S.basket.splice(dragI, 1); S.basket.splice(to, 0, m); dragI = -1;
  basketChanged(); renderBuilder();
});
$('#bSort').onchange = e => {
  const v = e.target.value; e.target.value = ''; if (!v) return;
  const qs = basketQs();
  const ex = q => EXAM_ORDER[q.exam];
  if (v === 'score') qs.sort((a,b) => a.score - b.score || a.num - b.num);
  if (v === 'unit') qs.sort((a,b) => a.unit - b.unit || a.score - b.score);
  if (v === 'year') qs.sort((a,b) => a.year - b.year || ex(a) - ex(b) || a.num - b.num);
  if (v === 'orig') qs.sort((a,b) => (a.type >= 5) - (b.type >= 5) || a.num - b.num || a.year - b.year);
  if (v === 'shuffle') for (let i = qs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i+1)); [qs[i], qs[j]] = [qs[j], qs[i]]; }
  S.basket = qs.map(q => q.id); basketChanged(); renderBuilder();
};
$('#bClear').onclick = () => { if (S.basket.length && confirm('담은 문항을 모두 비울까요?')) { S.basket = []; basketChanged(); renderBuilder(); changed(); } };

/* 자동 출제 */
function shuffle(a){ for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i+1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
$('#autoBtn').onclick = () => {
  const pool = Q.filter(q => test(q) && !S.basket.includes(q.id));
  const want = {2:+$('#a2').value||0, 3:+$('#a3').value||0, 4:+$('#a4').value||0};
  const spread = $('#aSpread').checked;
  const picked = [], short = [];
  [2,3,4].forEach(s => {
    const cand = shuffle(pool.filter(q => q.score === s)); let n = want[s];
    if (!n) return;
    if (spread){
      const by = new Map(); cand.forEach(q => { if (!by.has(q.unit)) by.set(q.unit, []); by.get(q.unit).push(q); });
      const keys = shuffle([...by.keys()]); let k = 0, got = 0;
      while (got < n && keys.some(u => by.get(u).length)) { const u = keys[k++ % keys.length]; const arr = by.get(u); if (arr.length) { picked.push(arr.pop()); got++; } }
      if (got < n) short.push(`${s}점 ${n - got}문항`);
    } else {
      picked.push(...cand.slice(0, n)); if (cand.length < n) short.push(`${s}점 ${n - cand.length}문항`);
    }
  });
  picked.sort((a,b) => a.score - b.score || a.num - b.num);
  picked.forEach(q => S.basket.push(q.id));
  basketChanged(); renderBuilder(); changed();
  $('#autoInfo').textContent = picked.length ? `${picked.length}문항을 담았습니다.` + (short.length ? ` (조건에 맞는 문항이 모자라 ${short.join(', ')}은 못 뽑았어요)` : '') : '조건에 맞는 문항이 없습니다. 문제 찾기의 검색 조건을 확인해 주세요.';
};

/* settings */
const SET_IDS = {title:'sTitle', sub:'sSub', time:'sTime', cols:'sCols', gap:'sGap', renum:'sRenum', source:'sSource', name:'sName', key:'sKey'};
function renderSettings(){
  for (const [k, id] of Object.entries(SET_IDS)) {
    const el = document.getElementById(id);
    if (el.type === 'checkbox') el.checked = !!S.settings[k]; else if (document.activeElement !== el) el.value = S.settings[k];
  }
}
for (const [k, id] of Object.entries(SET_IDS)) {
  const el = document.getElementById(id);
  el.addEventListener(el.tagName === 'INPUT' && el.type !== 'checkbox' ? 'input' : 'change', () => {
    S.settings[k] = el.type === 'checkbox' ? el.checked : el.value; save(); scheduleSheet();
  });
}

/* sheet layout (A4 @ 96dpi) */
const PW = 794, PH = 1123, PADX = 44, PADT = 40, PADB = 34, FOOT = 32, HEAD = 112, COLGAP = 29;
const GAPS = {s:18, m:70, l:160, xl:280};
let sheetTimer;
function scheduleSheet(){ clearTimeout(sheetTimer); sheetTimer = setTimeout(renderSheet, 120); }
function layoutPages(qs, st){
  const cols = +st.cols, innerW = PW - PADX*2;
  const colW = cols === 2 ? (innerW - COLGAP) / 2 : innerW;
  const k0 = Math.min(colW / MAXW, cols === 2 ? 1 : 0.62);
  const srcH = st.source ? 16 : 0, gap = GAPS[st.gap] || 70;
  const headH = (st.title || st.sub || st.name) ? HEAD : 0;
  const pages = []; let page = null, col = 0, used = 0;
  const avail = () => PH - PADT - PADB - FOOT - (pages.length === 1 ? headH : 0);
  const newPage = () => { page = {cols: Array.from({length: cols}, () => [])}; pages.push(page); col = 0; used = 0; };
  newPage();
  qs.forEach((q, i) => {
    let k = k0, h = q.h * k + srcH + gap;
    const full = avail();
    if (q.h * k + srcH > full) { k = (full - srcH - 8) / q.h; h = full; }
    if (used > 0 && used + h > avail() + gap * 0.6) {
      col++; used = 0;
      if (col >= cols) newPage();
    }
    page.cols[col].push({q, n: i + 1, k});
    used += h;
  });
  return {pages, colW, k0};
}
function qBlock(it, st){
  const q = it.q, k = it.k, w = q.w * k, h = q.h * k;
  let num = '';
  if (st.renum) {
    const [x0,y0,x1,y1] = q.nb; const bw = (x1 - x0) * k, bh = (y1 - y0) * k;
    const label = it.n + '.'; const fs = bh * 1.02;
    const est = fs * (0.5 * String(it.n).length + 0.27);
    const sx = Math.min(1, (bw + 2) / est);
    num = `<div class="num" style="left:${x0*k - 1}px;top:${y0*k - 1}px;width:${bw + 2}px;height:${bh + 2}px;font-size:${fs}px"><span style="display:inline-block;transform:scaleX(${sx.toFixed(3)});transform-origin:left center">${label}</span></div>`;
  }
  return `<div class="qb" style="${st.gap === 's' ? 'flex:0 0 auto;margin-bottom:' + GAPS.s + 'px' : ''}">
    <div class="qimg" style="width:${w}px;height:${h}px"><img src="${imgSrc(q)}" width="${w}" height="${h}" alt="">${num}</div>
    ${st.source ? `<div class="srcline">출처: ${esc(srcSheet(q))}</div>` : ''}
  </div>`;
}
function renderSheet(){
  const qs = basketQs(), st = S.settings;
  const sheet = $('#sheet');
  if (!qs.length) { sheet.innerHTML = `<div class="empty">문항을 담으면 여기에 시험지 미리보기가 나타납니다.</div>`; $('#pageInfo').textContent = ''; return; }
  const {pages} = layoutPages(qs, st);
  const keyRows = st.key ? qs.map((q,i) => ({q, n: i+1})) : [];
  const KEY_PER = 34;
  const keyPages = [];
  for (let i = 0; i < keyRows.length; i += KEY_PER) keyPages.push(keyRows.slice(i, i + KEY_PER));
  const totalPages = pages.length + keyPages.length;
  const total = qs.reduce((a,q) => a + q.score, 0);
  const foot = n => `<div class="p-foot"><span>문항 출처: 한국교육과정평가원 · 비영리 학습용</span><span class="pn">${n} / ${totalPages}</span><span>${esc(st.title || '')}</span></div>`;
  let html = '';
  pages.forEach((p, pi) => {
    let head = '';
    if (pi === 0 && (st.title || st.sub || st.name)) {
      head = `<div class="p-head"><div class="t"><h1>${esc(st.title || '')}</h1><div class="sub">${esc(st.sub || '')}</div></div>
        <div class="meta">${qs.length}문항 · ${total}점${st.time ? ' · ' + esc(st.time) : ''}
        ${st.name ? '<div class="p-name">번호 <span class="s"></span> 성명 <span></span></div>' : ''}</div></div>`;
    }
    html += `<div class="page-holder"><div class="page">${head}<div class="p-cont">${p.cols.map(c => `<div class="p-col">${c.map(it => qBlock(it, st)).join('')}</div>`).join('')}</div>${foot(pi + 1)}</div></div>`;
  });
  keyPages.forEach((rows, ki) => {
    html += `<div class="page-holder"><div class="page"><div class="key-title">문항 정보표${keyPages.length > 1 ? ` (${ki+1}/${keyPages.length})` : ''}</div>
      <table class="keytable"><thead><tr><th style="width:44px">번호</th><th>출처</th><th style="width:150px">단원</th><th style="width:48px">배점</th><th style="width:90px">정답</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${st.renum ? r.n : r.q.num}</td><td class="l">${esc(srcSheet(r.q))}</td><td>${esc(unitName(r.q.unit))}</td><td>${r.q.score}</td><td></td></tr>`).join('')}
      </tbody></table><div style="flex:1"></div>${foot(pages.length + ki + 1)}</div></div>`;
  });
  sheet.innerHTML = html;
  $('#pageInfo').textContent = `A4 ${totalPages}쪽 (문제 ${pages.length}쪽${keyPages.length ? ` + 정보표 ${keyPages.length}쪽` : ''})`;
  fitZoom();
}
function fitZoom(){
  const wrap = $('.preview-wrap'); const w = wrap.clientWidth - 30;
  $('#sheet').style.setProperty('--zoom', Math.max(0.3, Math.min(1, w / PW)).toFixed(3));
}
addEventListener('resize', () => { if ($('#tab-builder').classList.contains('active')) fitZoom(); });
$('#printBtn').onclick = async () => {
  if (!S.basket.length) return toast('먼저 문항을 담아 주세요');
  renderSheet();
  const imgs = $$('#sheet img');
  await Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  const old = document.title; document.title = S.settings.title || '시험지';
  window.print(); document.title = old;
};

/* saved sets & share */
function renderSaved(){
  const ul = $('#savedSets');
  ul.innerHTML = (S.sets || []).map((s, i) => `<li><span><b>${esc(s.name)}</b> <span class="muted small">${s.ids.length}문항 · ${esc(s.date)}</span></span>
    <button class="btn ghost" data-l="${i}">불러오기</button><button class="btn ghost danger" data-d="${i}">삭제</button></li>`).join('');
}
$('#saveSet').onclick = () => {
  if (!S.basket.length) return toast('담은 문항이 없습니다');
  const name = $('#setName').value.trim() || S.settings.title || '시험지';
  const d = new Date(); const date = `${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()}`;
  S.sets.unshift({name, ids: [...S.basket], settings: {...S.settings}, date}); save(); renderSaved(); toast('이 기기에 저장했습니다');
};
$('#savedSets').addEventListener('click', e => {
  const l = e.target.dataset.l, d = e.target.dataset.d;
  if (l !== undefined) { const s = S.sets[+l]; if (S.basket.length && !confirm('지금 담은 문항을 이 시험지로 바꿀까요?')) return;
    S.basket = s.ids.filter(id => byId.has(id)); S.settings = Object.assign({...DEF_SETTINGS}, s.settings); basketChanged(); renderBuilder(); changed(); toast('불러왔습니다'); }
  if (d !== undefined && confirm('저장한 시험지를 삭제할까요?')) { S.sets.splice(+d, 1); save(); renderSaved(); }
});
const enc = id => { const [y,e,t,n] = id.split('-'); return `${y.slice(2)}${e}${t}${n}`; };
const dec = s => { const m = s.match(/^(\d\d)([S69])([a-zA-Z]+)(\d\d)$/); return m ? `20${m[1]}-${m[2]}-${m[3]}-${m[4]}` : null; };
$('#shareSet').onclick = async () => {
  if (!S.basket.length) return toast('담은 문항이 없습니다');
  const url = location.origin + location.pathname + '#set=' + S.basket.map(enc).join('.') + '&t=' + encodeURIComponent(S.settings.title || '');
  try { await navigator.clipboard.writeText(url); toast('공유 링크를 복사했습니다'); }
  catch(e) { prompt('아래 링크를 복사하세요', url); }
};
function readHash(){
  const h = new URLSearchParams(location.hash.slice(1));
  const set = h.get('set'); if (!set) return;
  const ids = set.split('.').map(dec).filter(id => id && byId.has(id));
  history.replaceState(null, '', location.pathname);
  if (!ids.length) return;
  if (S.basket.length && !confirm(`공유받은 시험지(${ids.length}문항)를 불러올까요? 지금 담은 문항은 바뀝니다.`)) return;
  S.basket = ids; const t = h.get('t'); if (t) S.settings.title = t;
  basketChanged(); showTab('builder'); toast(`공유받은 시험지 ${ids.length}문항을 불러왔습니다`);
}

/* ================= 출제 통계 ================= */
let stExam = 'all', stScore = 'all';
function segBind(sel, set){ $$(sel + ' button').forEach(b => b.onclick = () => { $$(sel + ' button').forEach(x => x.classList.toggle('active', x === b)); set(b.dataset.v); renderStats(); }); }
segBind('#stExam', v => stExam = v); segBind('#stScore', v => stScore = v);
function renderStats(){
  const pool = Q.filter(q => (stExam === 'all' || (stExam === 'mock' ? q.exam > 0 : q.exam === 0)) && (stScore === 'all' || q.score === +stScore));
  const cnt = new Map(); let max = 1;
  pool.forEach(q => { const k = q.unit + '_' + q.year; cnt.set(k, (cnt.get(k)||0) + 1); });
  cnt.forEach(v => max = Math.max(max, v));
  const order = UNIT_GROUPS.flatMap(g => g.units);
  const rows = order.filter(u => pool.some(q => q.unit === u));
  let h = `<table class="heat"><thead><tr><th></th>${YEARS.map(y => `<th>${yearMode()==='hak' ? String(y+1).slice(2)+'학년' : y}</th>`).join('')}<th>합계</th></tr></thead><tbody>`;
  rows.forEach(u => {
    let sum = 0;
    h += `<tr><th class="u">${esc(unitName(u))}</th>` + YEARS.map(y => {
      const v = cnt.get(u + '_' + y) || 0; sum += v;
      if (!v) return `<td class="z">0</td>`;
      const p = Math.round(15 + 85 * v / max);
      return `<td data-u="${u}" data-y="${y}" style="background:color-mix(in srgb, var(--primary) ${p}%, transparent);color:${p > 55 ? 'var(--primary-ink)' : 'var(--text)'}" title="${y}년 · ${esc(unitName(u))} · ${v}문항">${v}</td>`;
    }).join('') + `<td class="sum">${sum}</td></tr>`;
  });
  h += '</tbody></table>';
  $('#heat').innerHTML = h;
  $$('#heat td[data-u]').forEach(td => td.onclick = () => {
    F = F0(); F.units = [+td.dataset.u]; F.yFrom = F.yTo = +td.dataset.y;
    if (stExam === '0') F.exams = [0]; if (stExam === 'mock') F.exams = [1,2];
    if (stScore === '4') F.scores = [4];
    showTab('browse'); changed();
  });
  const gc = new Map(); Q.forEach(q => { const g = groupOfUnit(q.unit); gc.set(g, (gc.get(g)||0) + 1); });
  const top = [...gc].sort((a,b) => b[1] - a[1])[0];
  const c4 = new Map(); Q.filter(q => q.score === 4).forEach(q => { const g = groupOfUnit(q.unit); c4.set(g, (c4.get(g)||0) + 1); });
  const top4 = [...c4].sort((a,b) => b[1] - a[1])[0];
  $('#statCards').innerHTML = [
    ['전체 문항', Q.length.toLocaleString(), '문항'],
    ['수능', Q.filter(q => q.exam === 0).length, '문항'],
    ['6월 · 9월 모의평가', Q.filter(q => q.exam > 0).length, '문항'],
    ['시험지 수', new Set(Q.map(q => q.year + '-' + q.exam + '-' + (q.type < 4 ? q.type : 'n'))).size, '회'],
    ['가장 많이 나온 단원', UNIT_GROUPS[top[0]].name, top[1] + '문항'],
    ['4점 문항 최다 단원', UNIT_GROUPS[top4[0]].name, top4[1] + '문항'],
  ].map(([k,v,u]) => `<div class="scard"><div class="k">${k}</div><div class="v">${esc(v)}<small>${u}</small></div></div>`).join('');
}

/* ================= 내 학습 기록 ================= */
function renderMe(){
  const st = Object.entries(S.status).filter(([id]) => byId.has(id));
  const c = s => st.filter(x => x[1] === s).length;
  $('#meCards').innerHTML = [
    ['표시한 문항', st.length, '문항'], ['⭕ 맞음', c('o'), '문항'], ['❌ 틀림', c('x'), '문항'],
    ['🔁 다시 보기', c('r'), '문항'], ['★ 즐겨찾기', Object.keys(S.fav).length, '문항'], ['📝 메모', Object.keys(S.notes).length, '문항'],
  ].map(([k,v,u]) => `<div class="scard"><div class="k">${k}</div><div class="v">${v}<small>${u}</small></div></div>`).join('');
  const rows = UNIT_GROUPS.map((g, gi) => {
    const ids = st.filter(([id]) => groupOfUnit(byId.get(id).unit) === gi);
    const o = ids.filter(x => x[1] === 'o').length, x = ids.filter(x => x[1] === 'x').length, r = ids.filter(x => x[1] === 'r').length, n = ids.length;
    return {g, gi, o, x, r, n};
  }).filter(r => r.n);
  $('#meTable').innerHTML = rows.length ? `<table class="mtable"><thead><tr><th>단원</th><th>표시</th><th>⭕</th><th>❌</th><th>🔁</th><th>비율</th><th></th></tr></thead><tbody>${rows.map(r => `<tr>
      <td><b>${esc(r.g.name)}</b></td><td>${r.n}</td><td>${r.o}</td><td>${r.x}</td><td>${r.r}</td>
      <td><div class="bar"><i style="width:${r.o/r.n*100}%;background:var(--o)"></i><i style="width:${r.x/r.n*100}%;background:var(--x)"></i><i style="width:${r.r/r.n*100}%;background:var(--r)"></i></div></td>
      <td>${r.x + r.r ? `<button class="btn ghost" data-g="${r.gi}">틀림·다시 보기 문항</button>` : ''}</td></tr>`).join('')}</tbody></table>`
    : '<div class="empty">아직 표시한 문항이 없습니다.</div>';
  $$('#meTable button[data-g]').forEach(b => b.onclick = () => {
    const g = UNIT_GROUPS[+b.dataset.g];
    F = F0(); F.units = [...g.units]; F.mine = 'x';
    const hasX = Q.some(q => g.units.includes(q.unit) && S.status[q.id] === 'x'); if (!hasX) F.mine = 'r';
    showTab('browse'); changed();
  });
  const notes = Object.entries(S.notes).filter(([id]) => byId.has(id));
  $('#meNotes').innerHTML = notes.length ? notes.map(([id, t]) => `<div class="note-item"><span class="src" data-id="${id}">${esc(srcShort(byId.get(id)))}</span><span class="txt">${esc(t)}</span></div>`).join('') : '<div class="empty">메모를 남긴 문항이 없습니다.</div>';
  $$('#meNotes .src').forEach(s => s.onclick = () => { const list = notes.map(([id]) => byId.get(id)); openModal(list.findIndex(q => q.id === s.dataset.id), list); });
}
$('#exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(S, null, 1)], {type: 'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  const d = new Date(); a.download = `문제은행-기록-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$('#importFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const obj = JSON.parse(await f.text());
    if (!obj || typeof obj !== 'object' || !('basket' in obj)) throw 0;
    if (!confirm('백업 파일로 지금 기록을 바꿀까요?')) return;
    S = Object.assign({basket:[], fav:{}, status:{}, notes:{}, sets:[], settings:{...DEF_SETTINGS}, prefs:{}}, obj);
    S.basket = S.basket.filter(id => byId.has(id)); save(); basketChanged(); renderMe(); changed(); toast('기록을 불러왔습니다');
  } catch(err) { alert('백업 파일을 읽지 못했습니다.'); }
  e.target.value = '';
};
$('#wipeBtn').onclick = () => {
  if (!confirm('맞음·틀림 표시, 즐겨찾기, 메모를 모두 지울까요? (담은 문항과 저장한 시험지는 남습니다)')) return;
  S.status = {}; S.fav = {}; S.notes = {}; save(); renderMe(); changed(); toast('기록을 지웠습니다');
};

/* ---------------- start ---------------- */
$('#basketCount').textContent = S.basket.length;
changed();
const startTab = S.prefs.tab && S.prefs.tab !== 'browse' ? S.prefs.tab : 'browse';
if (startTab !== 'browse') showTab(startTab);
readHash();
addEventListener('hashchange', readHash);
})();
