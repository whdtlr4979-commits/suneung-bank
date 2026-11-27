/* 기출각 · 공부하기
   오늘의 문제 · 무작위 연습 · 실전 모의고사 · 오답 다시 풀기 · 약한 단원 · 선생님이 보낸 문제
   기록(S.days / S.history / S.session)은 이 기기의 브라우저에만 저장돼요. */
(function(){
'use strict';
const A = () => window.QBAPP;
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const CIRC = ['①','②','③','④','⑤'];

/* ---------- 기록 ---------- */
function st(){
  const S = A().S;
  S.days = S.days || {}; S.history = S.history || [];
  const pp = S.prefs.prac || {};
  S.prefs.prac = {groups: pp.groups || [], scores: pp.scores || []};   // 무작위 연습은 단원 · 배점만 골라요
  S.prefs.mock = Object.assign({elective: 6, scope: 'kice'}, S.prefs.mock || {});
  return S;
}
function streak(){
  const S = st(); let n = 0; const d = new Date();
  if (!S.days[A().dayKey(d)]) d.setDate(d.getDate() - 1);      // 오늘 아직 안 풀었으면 어제부터 셈
  while (S.days[A().dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function hash(str){ let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const isElective = q => q.type >= 5;

/* ---------- 문제 고르기 ---------- */
function dailyQ(){
  const { Q } = A();
  const pool = Q.filter(q => q.year >= 2021 && q.type === 4 && q.score >= 3);
  return pool[hash('daily-' + A().dayKey()) % pool.length];
}
const PRACTICE_COUNT = 10;
function practicePool(p){
  const { Q } = A();
  return Q.filter(q => {
    if (p.groups.length && !p.groups.includes(A().groupOfUnit(q.unit))) return false;
    if (p.scores.length && !p.scores.includes(q.score)) return false;
    return true;
  });
}
function pickSpread(pool, n){
  // 단원이 고르게 섞이도록 뽑아요
  const by = new Map();
  A().shuffle(pool.slice()).forEach(q => { const g = A().groupOfUnit(q.unit); if (!by.has(g)) by.set(g, []); by.get(g).push(q); });
  const keys = A().shuffle([...by.keys()]), out = []; let k = 0;
  while (out.length < n && keys.some(g => by.get(g).length)) { const arr = by.get(keys[k++ % keys.length]); if (arr.length) out.push(arr.pop()); }
  return out;
}
function buildMock(elective, scope){
  const { Q } = A(), out = [];
  const ok = q => q.year >= 2021 && (scope === 'all' || A().IS_KICE(q.exam));
  for (let n = 1; n <= 30; n++) {
    const type = n <= 22 ? 4 : elective;
    const cand = Q.filter(q => ok(q) && q.type === type && q.num === n);
    if (cand.length) out.push(cand[Math.floor(Math.random() * cand.length)]);
  }
  return out;
}
function weakGroups(){
  const S = st(), { byId, UNIT_GROUPS } = A(), g = new Map();
  for (const [id, s] of Object.entries(S.status)) {
    const q = byId.get(id); if (!q || (s !== 'o' && s !== 'x')) continue;
    const k = A().groupOfUnit(q.unit), v = g.get(k) || {o: 0, x: 0}; v[s]++; g.set(k, v);
  }
  return [...g].map(([k, v]) => ({k, name: UNIT_GROUPS[k].name, n: v.o + v.x, rate: v.o / (v.o + v.x)}))
    .filter(v => v.n >= 4).sort((a, b) => a.rate - b.rate || b.n - a.n).slice(0, 3);
}

/* ---------- 공부하기 화면 ---------- */
let incoming = null;          // 선생님이 보낸 문제
window.receiveQuiz = (ids, title) => { incoming = {ids, title}; };

window.renderStudy = function(){
  const { esc, icon, nf, byId } = A(), S = st();
  const sk = streak();
  $('#streak').innerHTML = `<span class="flame${sk ? ' on' : ''}">${icon('flame')}</span><b>${sk}</b>일 연속`;
  $('#streak').title = sk ? `${sk}일 연속으로 문제를 풀었어요` : '오늘 한 문제를 풀면 연속 기록이 시작돼요';

  // 맨 위: 받은 문제 / 이어서 풀기
  let top = '';
  if (incoming) top += `<div class="banner accent">
      <div class="b-ic">${icon('play')}</div>
      <div class="b-txt"><b>${esc(incoming.title || '선생님이 보낸 문제')}</b><span>${incoming.ids.length}문항 · 원하는 방식으로 풀어 보세요</span></div>
      <div class="b-act"><button class="btn btn-secondary" data-act="inc-practice">한 문제씩 채점</button><button class="btn btn-primary" data-act="inc-exam">시험처럼 풀기</button><button class="icon-btn" data-act="inc-close" aria-label="닫기">${icon('x')}</button></div></div>`;
  if (S.session) {
    const s = S.session, done = Object.keys(s.answers).length;
    top += `<div class="banner">
      <div class="b-ic">${icon('clock')}</div>
      <div class="b-txt"><b>풀던 문제가 있어요 · ${esc(s.title)}</b><span>${s.ids.length}문항 중 ${done}문항 풀었어요${s.limit ? ' · 시간은 계속 흐르고 있어요' : ''}</span></div>
      <div class="b-act"><button class="btn btn-ghost" data-act="sess-drop">그만두기</button><button class="btn btn-primary" data-act="sess-resume">이어서 풀기</button></div></div>`;
  }
  $('#studyTop').innerHTML = top;

  // 오늘의 문제
  const dq = dailyQ(), dDone = S.myAns[dq.id] !== undefined, dOk = S.myAns[dq.id] === dq.ans;
  $('#daily').innerHTML = `<div class="card-head"><span class="eyebrow">${icon('sparkle')}오늘의 문제</span><span class="muted">${A().dayKey().replace(/-/g, '. ')}.</span></div>
    <div class="daily-body">
      <button class="daily-thumb" data-act="daily" aria-label="오늘의 문제 풀기"><img src="${A().imgSrc(dq)}" alt="" loading="lazy"></button>
      <div class="daily-side">
        <div class="daily-title">${esc(A().qTitle(dq))}</div>
        <div class="daily-tags"><span class="tag tag-s${dq.score}">${dq.score}점</span><span class="tag tag-gray">${esc(A().unitShort(dq.unit))}</span></div>
        <p class="muted small">반 친구들도 오늘 같은 문제를 풀어요. 내일이면 새 문제가 나와요.</p>
        ${dDone ? `<div class="daily-done ${dOk ? 'ok' : 'no'}">${icon(dOk ? 'check' : 'x')}${dOk ? '오늘 문제를 맞혔어요' : '아쉬워요 · 정답 ' + esc(A().ansText(dq))}</div>
          <button class="btn btn-secondary" data-act="daily">다시 보기</button>`
        : `<button class="btn btn-primary btn-lg" data-act="daily">${icon('play')}풀어 보기</button>`}
      </div></div>`;

  // 오늘 · 전체 요약
  const today = S.days[A().dayKey()] || 0;
  const st2 = Object.values(S.status), o = st2.filter(v => v === 'o').length, x = st2.filter(v => v === 'x').length;
  const week = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return {k: A().dayKey(d), d}; });
  const max = Math.max(1, ...week.map(w => S.days[w.k] || 0));
  $('#todayStats').innerHTML = `<div class="card-head"><span class="eyebrow">${icon('activity')}나의 학습</span></div>
    <div class="mini-kpis">
      <div><span>오늘 푼 문제</span><b>${today}</b></div>
      <div><span>정답률</span><b>${o + x ? Math.round(o / (o + x) * 100) + '%' : '-'}</b></div>
      <div><span>복습할 문제</span><b>${st2.filter(v => v === 'x' || v === 'r').length}</b></div>
    </div>
    <div class="week" aria-label="최근 7일 푼 문제 수">${week.map(w => { const v = S.days[w.k] || 0;
      return `<div class="wd${w.k === A().dayKey() ? ' today' : ''}" title="${w.d.getMonth() + 1}/${w.d.getDate()} · ${v}문제"><i style="height:${v ? Math.max(12, v / max * 100) : 4}%"${v ? '' : ' class="z"'}></i><span>${'일월화수목금토'[w.d.getDay()]}</span></div>`; }).join('')}</div>`;

  // 무작위 연습
  const p = S.prefs.prac, pool = practicePool(p), { UNIT_GROUPS } = A();
  const chip = (act, v, on, label) => `<button class="preset${on ? ' on' : ''}" data-act="${act}" data-v="${v}">${label}</button>`;
  const groupsShown = UNIT_GROUPS.map((g, i) => ({g, i})).filter(({i}) => i < 12);
  $('#practiceCard').innerHTML = `<div class="card-head"><span class="eyebrow">${icon('dice')}무작위 연습</span></div>
    <p class="muted small mb12">단원과 배점을 고르면 10문제를 무작위로 뽑아요. 한 문제씩 풀고 바로 채점해요.</p>
    <div class="opt"><div class="opt-k">단원</div><div class="presets">${chip('p-group', 'all', !p.groups.length, '전체')}${groupsShown.map(({g, i}) => chip('p-group', i, p.groups.includes(i), esc(g.name))).join('')}</div></div>
    <div class="opt"><div class="opt-k">배점</div><div class="presets">${chip('p-score', 'all', !p.scores.length, '전체')}${[2, 3, 4].map(s => chip('p-score', s, p.scores.includes(s), s + '점')).join('')}</div></div>
    <div class="card-foot"><span class="muted small">뽑을 수 있는 문제 ${nf(pool.length)}개</span><button class="btn btn-primary btn-lg" data-act="p-start" ${pool.length ? '' : 'disabled'}>${icon('play')}시작하기</button></div>`;

  // 실전 모의고사
  const m = S.prefs.mock;
  $('#examCard').innerHTML = `<div class="card-head"><span class="eyebrow">${icon('clock')}실전 모의고사</span></div>
    <p class="muted small mb12">지금 수능 체제(공통 1~22번 + 선택 23~30번) 그대로 같은 번호의 기출에서 한 문제씩 뽑아요. 번호마다 난이도가 실제 시험과 비슷해요.</p>
    <div class="opt"><div class="opt-k">선택과목</div><div class="seg seg-full">${[[5, '확률과 통계'], [6, '미적분'], [7, '기하']].map(([t, l]) => `<button data-act="m-el" data-v="${t}" class="${m.elective === t ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="opt"><div class="opt-k">출제 범위</div><div class="seg seg-full"><button data-act="m-scope" data-v="kice" class="${m.scope === 'kice' ? 'on' : ''}">수능 · 모의평가</button><button data-act="m-scope" data-v="all" class="${m.scope === 'all' ? 'on' : ''}">학력평가 포함</button></div></div>
    <ul class="exam-facts"><li>${icon('clock')}100분 · 시간이 끝나면 자동으로 제출돼요</li><li>${icon('check')}30문항 · 100점 만점으로 채점</li><li>${icon('repeat')}풀 때마다 다른 문제로 구성돼요</li></ul>
    <div class="card-foot"><span></span><button class="btn btn-primary btn-lg" data-act="m-start">${icon('play')}시험 시작</button></div>`;

  // 오답 · 약한 단원
  const review = Object.entries(S.status).filter(([id, v]) => (v === 'x' || v === 'r') && byId.has(id)).map(([id]) => id);
  const weak = weakGroups();
  $('#reviewCard').innerHTML = `<div class="card-head"><span class="eyebrow">${icon('repeat')}복습</span></div>
    <div class="review-main">
      <div><b class="big">${review.length}</b><span class="muted"> 문제</span><p class="muted small">틀렸거나 ‘다시 보기’로 표시한 문제예요. 맞히면 복습 목록에서 빠져요.</p></div>
      <button class="btn btn-primary" data-act="review" ${review.length ? '' : 'disabled'}>${icon('play')}오답 다시 풀기</button>
    </div>
    <div class="sub-k">약한 단원</div>
    ${weak.length ? `<div class="weak-list">${weak.map(w => `<button class="weak" data-act="weak" data-v="${w.k}">
        <span class="w-name">${esc(w.name)}</span><span class="w-bar"><i style="width:${Math.round(w.rate * 100)}%"></i></span><span class="w-rate">${Math.round(w.rate * 100)}%</span><span class="w-go">10문제 ${icon('right')}</span></button>`).join('')}</div>`
      : `<p class="muted small">단원마다 4문제 이상 풀면 정답률이 낮은 단원을 찾아 드려요.</p>`}`;

  // 최근 학습
  const hist = S.history.slice(0, 6);
  $('#historyCard').innerHTML = `<div class="card-head"><span class="eyebrow">${icon('chart')}최근 학습</span></div>
    ${hist.length ? `<ul class="hist">${hist.map((h, i) => `<li data-act="hist" data-v="${i}">
        <span class="h-k ${h.mode}">${{practice: '연습', exam: '시험', review: '복습', daily: '오늘', shared: '받은 문제', weak: '단원'}[h.mode] || '연습'}</span>
        <span class="h-t"><b>${esc(h.title)}</b><span>${h.date.slice(5).replace('-', '/')} · ${h.n}문항 · ${fmtTime(h.sec)}</span></span>
        <span class="h-s">${h.mode === 'exam' ? `<b>${h.score}</b>/${h.total}점` : `<b>${h.correct}</b>/${h.n}`}</span></li>`).join('')}</ul>`
      : `<div class="empty compact">${icon('chart', 'empty-ic')}<strong>아직 기록이 없어요</strong><p>오늘의 문제부터 풀어 볼까요?</p></div>`}`;
};

/* ---------- 이벤트 ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('#tab-study [data-act]'); if (!b) return;
  const S = st(), p = S.prefs.prac, m = S.prefs.mock, v = b.dataset.v, act = b.dataset.act;
  const tog = (arr, x) => { const i = arr.indexOf(x); i >= 0 ? arr.splice(i, 1) : arr.push(x); };
  switch (act) {
    case 'p-group': v === 'all' ? (p.groups = []) : tog(p.groups, +v); break;
    case 'p-score': v === 'all' ? (p.scores = []) : tog(p.scores, +v); break;
    case 'm-el': m.elective = +v; break;
    case 'm-scope': m.scope = v; break;
    case 'p-start': {
      const qs = pickSpread(practicePool(p), PRACTICE_COUNT);
      if (!qs.length) return A().toast('조건에 맞는 문제가 없어요');
      return start('practice', '무작위 연습', qs);
    }
    case 'm-start': {
      const qs = buildMock(m.elective, m.scope);
      return start('exam', `실전 모의고사 · ${A().TYPE_NAME[m.elective]}`, qs, 100 * 60);
    }
    case 'daily': return start('daily', '오늘의 문제', [dailyQ()]);
    case 'review': {
      const ids = Object.entries(S.status).filter(([, s]) => s === 'x' || s === 'r').map(([id]) => id);
      return start('review', '오답 다시 풀기', A().shuffle(ids.map(id => A().byId.get(id)).filter(Boolean)).slice(0, 20));
    }
    case 'weak': {
      const k = +v, pool = A().Q.filter(q => A().groupOfUnit(q.unit) === k && S.status[q.id] !== 'o');
      return start('weak', `약한 단원 · ${A().UNIT_GROUPS[k].name}`, A().shuffle(pool.slice()).slice(0, 10));
    }
    case 'inc-practice': case 'inc-exam': {
      const qs = incoming.ids.map(id => A().byId.get(id)).filter(Boolean), t = incoming.title || '선생님이 보낸 문제';
      incoming = null;
      return act === 'inc-exam' ? start('shared', t, qs, Math.max(10, Math.round(qs.length * 3.3)) * 60) : start('shared', t, qs);
    }
    case 'inc-close': incoming = null; break;
    case 'sess-resume': return openSolve();
    case 'sess-drop': if (!confirm('풀던 문제를 그만둘까요? 지금까지 고른 답은 저장되지 않아요.')) return; S.session = null; break;
    case 'hist': return showResult(S.history[+v], true);
    default: return;
  }
  A().save(); window.renderStudy();
});

/* ================= 문제 풀기 ================= */
let timer = null;
const fmtTime = sec => { sec = Math.max(0, Math.round(sec || 0)); const m = Math.floor(sec / 60), s = sec % 60; return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; };
const sess = () => st().session;
const curQ = () => A().byId.get(sess().ids[sess().i]);
const timed = s => !!s.limit;

function start(mode, title, qs, limit = null){
  const S = st();
  if (S.session && !confirm('풀던 문제가 있어요. 새로 시작할까요?')) return;
  S.session = {mode, title, ids: qs.map(q => q.id), i: 0, answers: {}, revealed: {}, start: Date.now(), limit};
  A().save(); openSolve();
}
function openSolve(){
  $('#solve').classList.remove('hidden'); document.body.style.overflow = 'hidden';
  renderQ(); clearInterval(timer); timer = setInterval(tick, 1000); tick();
}
function closeSolve(){
  clearInterval(timer); $('#solve').classList.add('hidden'); document.body.style.overflow = '';
  if (A()) window.renderStudy();
}
function tick(){
  const s = sess(); if (!s) return;
  const el = (Date.now() - s.start) / 1000;
  if (timed(s)) {
    const left = s.limit - el;
    $('#sTimer').innerHTML = `${A().icon('clock')}${fmtTime(left)}`;
    $('#sTimer').classList.toggle('warn', left < 300);
    if (left <= 0) { A().toast('시간이 끝나서 제출했어요'); finish(); }
  } else $('#sTimer').innerHTML = `${A().icon('clock')}${fmtTime(el)}`;
}
function renderQ(){
  const s = sess(); if (!s) return closeSolve();
  const { esc, icon, imgSrc, isShort, ansText, unitShort, qTitle } = A();
  const q = curQ(), n = s.ids.length, mine = s.answers[q.id], checked = !timed(s) && (mine !== undefined || s.revealed[q.id]);
  const done = Object.keys(s.answers).length;
  $('#solveTitle').textContent = `${s.title} · ${s.i + 1} / ${n}`;
  $('#sBar').style.width = `${(timed(s) ? done : s.i + (checked ? 1 : 0)) / n * 100}%`;
  const sa = isShort(q), ok = mine === q.ans;
  const choices = sa ? `<form class="sa-row" id="sSA" autocomplete="off"><input class="input" id="sSAin" inputmode="numeric" maxlength="4" placeholder="답을 입력하세요" value="${mine !== undefined ? mine : ''}" ${checked ? 'disabled' : ''}><button class="btn btn-primary" ${checked ? 'disabled' : ''}>${timed(s) ? '저장' : '채점'}</button></form>`
    : `<div class="choice-row big" id="sChoices">${CIRC.map((c, i) => { const v = i + 1; let cls = '';
        if (timed(s)) cls = mine === v ? 'picked' : '';
        else if (checked) cls = mine === v ? (v === q.ans ? 'right' : 'wrong') : (v === q.ans ? 'answer' : '');
        return `<button data-c="${v}" class="${cls}" ${checked ? 'disabled' : ''} aria-label="${v}번">${c}</button>`; }).join('')}</div>`;
  let feedback = '';
  if (checked) feedback = mine === undefined ? `<div class="v-result info">정답은 <b>${esc(ansText(q))}</b> · 복습 목록에 넣었어요</div>`
    : `<div class="v-result ${ok ? 'ok' : 'no'}">${icon(ok ? 'check' : 'x')}${ok ? '정답이에요' : `아쉬워요 · 정답은 <b>${esc(ansText(q))}</b>`}</div>`;
  const meta = `<div class="s-meta"><span class="tag tag-s${q.score}">${q.score}점</span>${checked || s.mode === 'review' ? `<span class="tag tag-gray">${esc(unitShort(q.unit))}</span><span class="muted small">${esc(qTitle(q))}</span>` : ''}</div>`;
  const last = s.i === n - 1;
  const nav = timed(s)
    ? `<div class="s-grid">${s.ids.map((id, i) => `<button data-go="${i}" class="${i === s.i ? 'cur' : ''}${s.answers[id] !== undefined ? ' done' : ''}">${i + 1}</button>`).join('')}</div>
       <div class="s-btns"><button class="btn btn-secondary" data-nav="-1" ${s.i ? '' : 'disabled'}>${icon('left')}이전</button>
       ${last ? '' : `<button class="btn btn-secondary" data-nav="1">다음${icon('right')}</button>`}
       <button class="btn btn-primary grow" data-act="submit">제출하기 <span class="muted-inv">${done}/${n}</span></button></div>`
    : `<div class="s-btns">${checked ? `<button class="btn btn-secondary" data-act="viewq">${icon('expand')}문항 크게</button><button class="btn btn-primary grow" data-nav="1">${last ? '결과 보기' : '다음 문제'}${icon('right')}</button>`
      : `<button class="btn btn-ghost grow" data-act="reveal">모르겠어요 · 정답 보기</button>`}</div>`;
  $('#sBody').innerHTML = `<div class="s-stage"><div class="paper"><img src="${imgSrc(q)}" alt="${esc(qTitle(q))} 문제"></div></div>
    <aside class="s-panel">${meta}<div class="v-label">${sa ? '답 (단답형)' : '답 고르기'}</div>${choices}${feedback}${nav}
    <div class="kbd-hint hide-sm">${sa ? '<kbd>Enter</kbd> 채점' : '<kbd>1</kbd>~<kbd>5</kbd> 답 고르기'} ${timed(s) ? '<kbd>←</kbd><kbd>→</kbd> 이동' : '<kbd>Enter</kbd> 다음'} <kbd>Esc</kbd> 나가기</div></aside>`;
  $('.s-stage').scrollTop = 0;
  const inp = $('#sSAin'); if (inp && !checked && matchMedia('(hover:hover)').matches) inp.focus();
}
function choose(v){
  const s = sess(), q = curQ();
  if (!timed(s) && (s.answers[q.id] !== undefined || s.revealed[q.id])) return;
  s.answers[q.id] = v;
  if (!timed(s)) record(q, v);                      // 연습: 바로 채점하고 기록
  A().save(); renderQ();
}
function record(q, v){
  const S = st();
  S.myAns[q.id] = v; S.status[q.id] = v === q.ans ? 'o' : 'x';
  A().markDay(1); A().refreshCard(q.id);
}
function move(d){
  const s = sess(), n = s.ids.length;
  if (!timed(s) && d > 0 && s.i === n - 1) return finish();
  s.i = Math.max(0, Math.min(n - 1, s.i + d)); A().save(); renderQ();
}
function finish(){
  const S = st(), s = S.session; if (!s) return;
  const qs = s.ids.map(id => A().byId.get(id)).filter(Boolean);
  if (timed(s)) qs.forEach(q => { if (s.answers[q.id] !== undefined) record(q, s.answers[q.id]); });
  const correct = qs.filter(q => s.answers[q.id] === q.ans);
  const h = {mode: s.limit && s.mode !== 'shared' ? 'exam' : s.mode, title: s.title, date: A().dayKey(), n: qs.length, correct: correct.length,
    score: correct.reduce((a, q) => a + q.score, 0), total: qs.reduce((a, q) => a + q.score, 0),
    sec: Math.min((Date.now() - s.start) / 1000, s.limit || Infinity), ids: s.ids, answers: s.answers};
  if (s.limit && s.mode === 'shared') h.mode = 'shared';
  S.history.unshift(h); S.history = S.history.slice(0, 40);
  S.session = null; A().save(); clearInterval(timer);
  showResult(h);
}
function showResult(h, fromHistory){
  const { esc, icon, byId, ansText, unitShort, srcSheet, nf } = A();
  if (fromHistory) { $('#solve').classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  const qs = h.ids.map(id => byId.get(id)).filter(Boolean);
  const wrong = qs.filter(q => h.answers[q.id] !== q.ans);
  const pct = h.n ? Math.round(h.correct / h.n * 100) : 0;
  const msg = pct === 100 ? '완벽해요!' : pct >= 80 ? '훌륭해요' : pct >= 50 ? '좋아요, 조금만 더!' : '틀린 문제를 다시 풀어 봐요';
  $('#solveTitle').textContent = `${h.title} · 결과`; $('#sBar').style.width = '100%'; $('#sTimer').innerHTML = '';
  $('#sBody').innerHTML = `<div class="result">
    <div class="r-hero">
      <div class="r-ring" style="--p:${pct}"><div><b>${h.mode === 'exam' ? h.score : h.correct}</b><span>${h.mode === 'exam' ? `/ ${h.total}점` : `/ ${h.n}문제`}</span></div></div>
      <div class="r-txt"><h2>${msg}</h2><p class="muted">${h.n}문항 중 ${h.correct}문항 정답 · 정답률 ${pct}% · ${fmtTime(h.sec)}${h.mode === 'exam' ? '' : ` · ${h.score}/${h.total}점`}</p>
        <div class="row gap8 wrap mt12">
          ${wrong.length ? `<button class="btn btn-primary" data-r="retry">${icon('repeat')}틀린 ${wrong.length}문제 다시 풀기</button>` : ''}
          <button class="btn btn-secondary" data-r="basket">${icon('doc')}시험지로 만들기</button>
          <button class="btn btn-ghost" data-r="close">닫기</button>
        </div></div>
    </div>
    <div class="r-table"><div class="r-row r-head"><span>번호</span><span>출처 · 단원</span><span>내 답</span><span>정답</span><span></span></div>
    ${qs.map((q, i) => { const a = h.answers[q.id], ok = a === q.ans; return `<button class="r-row ${ok ? 'ok' : 'no'}" data-r="view" data-v="${i}">
        <span class="r-n">${i + 1}</span><span class="r-src"><b>${esc(srcSheet(q))}</b><span>${esc(unitShort(q.unit))} · ${q.score}점</span></span>
        <span class="r-a">${a === undefined ? '-' : esc(A().isShort(q) ? String(a) : CIRC[a - 1])}</span><span class="r-a">${esc(ansText(q))}</span>
        <span class="r-mark">${icon(ok ? 'check' : 'x')}</span></button>`; }).join('')}</div></div>`;
  $('#sBody').dataset.h = JSON.stringify({ids: h.ids, wrong: wrong.map(q => q.id), title: h.title});
}

/* 풀이 화면 이벤트 */
$('#sBody').addEventListener('click', e => {
  const c = e.target.closest('#sChoices button'); if (c) return choose(+c.dataset.c);
  const g = e.target.closest('[data-go]'); if (g) { sess().i = +g.dataset.go; A().save(); return renderQ(); }
  const nv = e.target.closest('[data-nav]'); if (nv) return move(+nv.dataset.nav);
  const a = e.target.closest('[data-act]');
  if (a && a.dataset.act === 'reveal') { const s = sess(), q = curQ(); s.revealed[q.id] = 1; st().status[q.id] = 'r'; A().markDay(1); A().refreshCard(q.id); A().save(); return renderQ(); }
  if (a && a.dataset.act === 'viewq') return A().openViewer(sess().i, sess().ids.map(id => A().byId.get(id)));
  if (a && a.dataset.act === 'submit') {
    const s = sess(), left = s.ids.length - Object.keys(s.answers).length;
    if (!confirm(left ? `아직 ${left}문항을 풀지 않았어요. 제출할까요?` : '제출할까요?')) return;
    return finish();
  }
  const r = e.target.closest('[data-r]'); if (!r) return;
  const info = JSON.parse($('#sBody').dataset.h || '{}');
  if (r.dataset.r === 'close') return closeSolve();
  if (r.dataset.r === 'retry') return start('review', `${info.title} · 틀린 문제`, A().shuffle(info.wrong.map(id => A().byId.get(id))));
  if (r.dataset.r === 'basket') { A().setBasket(info.ids); closeSolve(); A().showTab('builder'); return A().toast(`${info.ids.length}문항을 시험지에 담았어요`); }
  if (r.dataset.r === 'view') return A().openViewer(+r.dataset.v, info.ids.map(id => A().byId.get(id)));
});
$('#sBody').addEventListener('submit', e => {
  if (e.target.id !== 'sSA') return; e.preventDefault();
  const v = $('#sSAin').value.trim();
  if (!/^\d{1,4}$/.test(v)) return A().toast('숫자로 입력해 주세요');
  choose(+v);
  if (timed(sess() || {}) && sess().i < sess().ids.length - 1) A().toast('답을 저장했어요');
});
$('#sExit').onclick = () => {
  const s = sess();
  if (!s) return closeSolve();
  if (timed(s)) { closeSolve(); return A().toast('나중에 이어서 풀 수 있어요 · 시간은 계속 흘러요'); }
  const done = Object.keys(s.answers).length + Object.keys(s.revealed).length;
  if (done && confirm('여기까지 결과를 볼까요? (취소하면 나중에 이어서 풀 수 있어요)')) return finish();
  closeSolve();
};
document.addEventListener('keydown', e => {
  if ($('#solve').classList.contains('hidden') || !$('#viewer').classList.contains('hidden')) return;
  if (e.key === 'Escape') return $('#sExit').click();
  const s = sess(); if (!s) return;
  if (e.target.tagName === 'INPUT') return;
  if (/^[1-5]$/.test(e.key) && $('#sChoices')) return choose(+e.key);
  if (timed(s) && e.key === 'ArrowRight') return move(1);
  if (timed(s) && e.key === 'ArrowLeft') return move(-1);
  if (!timed(s) && e.key === 'Enter') { const nx = $('[data-nav="1"]'); if (nx) nx.click(); }
});
})();
