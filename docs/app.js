/* ============================================================
 * خَلّد — app.js  v2.1
 * منصة ألعاب أبو خالد | Cloudflare Workers + Durable Objects
 * ============================================================ */
'use strict';

// ─── مساعدات أساسية ──────────────────────────────────────────
const $ = id => document.getElementById(id);
const esc = s => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const show = id => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  $(id).classList.add('on');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ─── التخزين المحلي ──────────────────────────────────────────
const MEM = {};
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('kh_' + k);
      return v ? JSON.parse(v) : (k in MEM ? MEM[k] : d);
    } catch { return k in MEM ? MEM[k] : d; }
  },
  set(k, v) {
    MEM[k] = v;
    try { localStorage.setItem('kh_' + k, JSON.stringify(v)); } catch {}
  },
};

// ─── مساعدات التصفية والاختيار ───────────────────────────────
function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pickNext(key, arr) {
  let used = store.get('u_' + key, []);
  if (used.length >= arr.length) used = [];
  const avail = arr.map((_, i) => i).filter(i => !used.includes(i));
  const i = avail[Math.floor(Math.random() * avail.length)];
  used.push(i); store.set('u_' + key, used);
  return arr[i];
}

// ─── نظام الصوت ──────────────────────────────────────────────
let AC = null, muted = false;
function actx() {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  return AC;
}
function tone(f, d, type = 'sine', v = .18, delay = 0) {
  if (muted) return;
  try {
    const a = actx(), o = a.createOscillator(), g = a.createGain(),
          t = a.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(.001, t + d);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + d + .02);
  } catch {}
}
const sClick  = () => tone(640, .08, 'triangle', .15);
const sOpen   = () => { tone(420, .1, 'sine', .16); tone(640, .12, 'sine', .16, .09); };
const sTick   = () => tone(1100, .05, 'square', .07);
const sReveal = () => { tone(520, .14, 'triangle', .18); tone(780, .2, 'triangle', .18, .1); };
const sAward  = () => [523,659,784,1046].forEach((f,i) => tone(f,.16,'triangle',.2,i*.09));
const sNone   = () => { tone(220,.22,'sawtooth',.13); tone(160,.3,'sawtooth',.13,.14); };
const sWin    = () => [523,659,784,1046,784,1046,1318].forEach((f,i) => tone(f,.22,'triangle',.22,i*.13));
const sSwap   = () => { tone(880,.1,'sine',.16); tone(660,.1,'sine',.16,.1); tone(880,.14,'sine',.16,.2); };
const sBuzz   = () => tone(180, .35, 'sawtooth', .2);
function toggleMute() { muted = !muted; $('muteBtn').textContent = muted ? '🔇' : '🔊'; }

// ─── نظام الـ Toast ───────────────────────────────────────────
let _toastTimer = null;
function toast(msg, type = 'info', dur = 3500) {
  let el = $('_toast');
  if (!el) {
    el = document.createElement('div'); el.id = '_toast';
    el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
      'z-index:200;max-width:340px;width:90%;padding:13px 20px;border-radius:16px;' +
      'font-weight:800;font-size:15px;text-align:center;backdrop-filter:blur(8px);' +
      'transition:opacity .35s;pointer-events:none;font-family:Tajawal,sans-serif;';
    document.body.appendChild(el);
  }
  const bg = {
    info:    '#1f1148;border:1px solid #8b5cf677',
    success: '#064e3b;border:1px solid #34d39977',
    warn:    '#451a03;border:1px solid #fbbf2477',
    err:     '#3b0764;border:1px solid #f472b677',
  };
  el.style.cssText += `background:${bg[type]||bg.info};color:#f3f0ff;opacity:1;`;
  el.textContent = msg;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.style.opacity = '0'; }, dur);
}

// ─── confetti ─────────────────────────────────────────────────
function confetti() {
  const colors = ['#22d3ee','#8b5cf6','#d946ef','#f472b6','#fbbf24','#34d399'];
  for (let i = 0; i < 120; i++) {
    const c = document.createElement('div'); c.className = 'confetti';
    const s = 6 + Math.random() * 8;
    c.style.cssText = `left:${Math.random()*100}vw;width:${s}px;height:${s*1.4}px;` +
      `background:${colors[i%colors.length]};animation-duration:${2.4+Math.random()*2.4}s;` +
      `animation-delay:${Math.random()*1.6}s`;
    document.body.appendChild(c); setTimeout(() => c.remove(), 7000);
  }
}

// ─── Modal ────────────────────────────────────────────────────
function modal(html) { $('mbox').innerHTML = html; $('modal').classList.add('on'); }
function closeModal() { $('modal').classList.remove('on'); }
$('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ─── مشاركة النتائج ──────────────────────────────────────────
async function shareResult(title, text) {
  const shareData = { title: 'خَلّد 🎮', text };
  if (navigator.share) {
    try { await navigator.share(shareData); return; } catch {}
  }
  // Fallback: WhatsApp
  const waUrl = 'https://wa.me/?text=' + encodeURIComponent(`🎮 خَلّد\n${text}\nالعب الآن: ${location.origin}`);
  modal(`<div class="sec-title">🎉 شارك نتيجتك</div>
    <div style="font-weight:800;text-align:center;font-size:18px;margin:16px 0;color:var(--amber)">${esc(text)}</div>
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:12px">
      <a href="${waUrl}" target="_blank" rel="noopener"
         style="background:#25D366;color:#fff;padding:12px 22px;border-radius:14px;font-weight:800;text-decoration:none;font-family:Tajawal,sans-serif">
        واتساب 💬</a>
      <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard?.writeText('${esc(text)}');toast('تم النسخ ✓','success')">نسخ النص 📋</button>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">إغلاق</button>
    </div>`);
}

// ─── بيانات الأسئلة والألعاب ─────────────────────────────────
const BANK = window.KHALLAD_BANK || {};
const GM   = window.KHALLAD_GAMES || {};

// دمج الأسئلة المحفوظة محلياً
(store.get('custom_qs', [])).forEach(q => {
  if (BANK[q.cat]) BANK[q.cat].qs.push({ p: +q.p, q: q.q, a: q.a });
});

// جلب الأسئلة من قاعدة البيانات (D1)
fetch('/api/questions').then(r => r.json()).then(list => {
  (list || []).forEach(q => {
    if (BANK[q.cat] && !BANK[q.cat].qs.some(x => x.q === q.q))
      BANK[q.cat].qs.push({ p: +q.p, q: q.q, a: q.a });
  });
  fillStats();
}).catch(() => {});

function totalQ() {
  let n = Object.values(BANK).reduce((s, c) => s + c.qs.length, 0);
  n += GM.pic ? (GM.pic.odd.length + GM.pic.zoom.length + GM.pic.riddle.length) : 0;
  n += GM.riddles ? GM.riddles.length : 0;
  n += GM.feud   ? GM.feud.length   : 0;
  n += GM.who    ? GM.who.length    : 0;
  n += GM.whofast? GM.whofast.length: 0;
  n += GM.fast   ? GM.fast.length   : 0;
  n += GM.letters? GM.letters.letters.length * (GM.letters.normal.length + GM.letters.speed.length) : 0;
  n += GM.words  ? Object.values(GM.words).reduce((s,t) => s + Object.values(t).reduce((x,l) => x + l.length, 0), 0) : 0;
  return n;
}
function fillStats() { $('statQ').textContent = totalQ().toLocaleString('ar-EG'); }
fillStats();

// ─── Hub — الصفحة الرئيسية ───────────────────────────────────
const HUBS = [
  { id:'sj',   t:'سين جيم',             ic:'🧠', e1:'❓', e2:'💡', d:'اللعبة الكبرى: فئات ولوحة نقاط ووسائل مساعدة + أونلاين', g:'linear-gradient(150deg,#4c1d95,#1e1b4b)', n:()=>Object.values(BANK).reduce((s,c)=>s+c.qs.length,0)+' سؤال', go:()=>show('scr-mode') },
  { id:'pic',  t:'تحدي الصور',          ic:'🖼️', e1:'🔍', e2:'👀', d:'القط المختلف، اللقطة المقرّبة، وألغاز الإيموجي البصرية',  g:'linear-gradient(150deg,#0e7490,#164e63)', n:()=>(GM.pic.odd.length+GM.pic.zoom.length+GM.pic.riddle.length)+' تحدي', go:()=>mgStart('pic') },
  { id:'let',  t:'الحروف مع أبو خالد', ic:'🔤', e1:'⚡', e2:'🎡', d:'عجلة تختار الحرف… وجاوب قبل ما يخلص الوقت!',             g:'linear-gradient(150deg,#9d174d,#500724)', n:()=>GM.letters.letters.length*(GM.letters.normal.length+GM.letters.speed.length)+' تحدي', go:()=>mgStart('let') },
  { id:'rz',   t:'فوازير',              ic:'🧩', e1:'🤔', e2:'💭', d:'ألغاز منطقية وكلامية تكسّر الرأس',                       g:'linear-gradient(150deg,#92400e,#451a03)', n:()=>GM.riddles.length+' لغز', go:()=>mgStart('rz') },
  { id:'feud', t:'فاميلي فيود',         ic:'📊', e1:'🎤', e2:'❌', d:'استطلاع رأي: خمّنوا الإجابات الأكثر شيوعاً واقلبوا البطاقات', g:'linear-gradient(150deg,#1d4ed8,#172554)', n:()=>GM.feud.length+' استطلاع', go:()=>mgStart('feud') },
  { id:'wb',   t:'بنك الكلمات',         ic:'🎭', e1:'✏️', e2:'🃏', d:'مثّل، ارسم، أو اشرح الكلمة وخل فريقك يخمّن',            g:'linear-gradient(150deg,#047857,#022c22)', n:()=>Object.values(GM.words).reduce((s,t)=>s+Object.values(t).reduce((x,l)=>x+l.length,0),0)+' كلمة', go:()=>mgStart('wb') },
  { id:'who',  t:'من أنا؟',             ic:'🕵️', e1:'❔', e2:'🎩', d:'تلميحات من الصعب للسهل… كل تلميح ينقص نقاطك',          g:'linear-gradient(150deg,#7c2d12,#3b0764)', n:()=>GM.who.length+' شخصية', go:()=>mgStart('who') },
  { id:'wf',   t:'من الشخصية؟',        ic:'⚡', e1:'👤', e2:'💨', d:'3 تلميحات سريعة وجولات خاطفة',                           g:'linear-gradient(150deg,#be123c,#4c0519)', n:()=>GM.whofast.length+' شخصية', go:()=>mgStart('wf') },
  { id:'fast',  t:'مين أسرع واحد؟',    ic:'🏁', e1:'🏃', e2:'⏱️', d:'أوامر لحظية: أول واحد يسوّيها ياخذ النقطة!',                                   g:'linear-gradient(150deg,#a16207,#422006)', n:()=>GM.fast.length+' أمر',           go:()=>mgStart('fast') },
  { id:'guess', t:'خمن الصورة',         ic:'🖼️', e1:'👁️', e2:'❓', d:'ألغاز إيموجي بصرية: خمّن الأكلة أو المدينة أو الشخصية من الصور!',                g:'linear-gradient(150deg,#0c4a6e,#075985)', n:()=>(window.KHALLAD_EXTRA?.guess.length||0)+' لغزة',  go:()=>mgStart('guess') },
  { id:'harf',  t:'حروف وألوف',         ic:'⬡',  e1:'🔤', e2:'🎯', d:'شبكة 25 حرف: كل حرف سؤال! اختر الحرف وجاوب وادّعِ الخلية قبل منافسك',          g:'linear-gradient(150deg,#3b0764,#6b21a8)', n:()=>'25 حرف × أسئلة لا تنتهي',          go:()=>mgStart('harf') },
  { id:'midan', t:'الميدان',             ic:'🏟️', e1:'⚔️', e2:'🏆', d:'تنافس على مربعات الميدان! أجب على السؤال وادّعِ المنطقة • من يملأ الميدان يفوز', g:'linear-gradient(150deg,#064e3b,#022c22)', n:()=>'12 فئة × جولات لا تنتهي',           go:()=>mgStart('midan') },
  { id:'bankq', t:'بنك الأسئلة',        ic:'💰', e1:'💵', e2:'🏦', d:'اختار السؤال اللي تبيه: 200 نقطة للسهل أو 600 للصعب! وإذا أخطأت الثاني يسرق',   g:'linear-gradient(150deg,#78350f,#451a03)', n:()=>'أسئلة × 3 مستويات',               go:()=>mgStart('bankq') },
];

$('hubGrid').innerHTML = HUBS.map((h, i) =>
  `<div class="game-card" style="background:${h.g}" onclick="sClick();HUBS[${i}].go()">
    <span class="gc-emo e1">${h.e1}</span><span class="gc-emo e2">${h.e2}</span>
    <span class="gc-n">${typeof h.n === 'function' ? h.n() : h.n}</span>
    <span class="gc-ic">${h.ic}</span><div class="gc-t">${h.t}</div><div class="gc-d">${h.d}</div>
  </div>`).join('');

function goHub() { sClick(); MG = null; clearInterval(mgTimerInt); show('scr-hub'); }

// ─── Auth — Google Login ──────────────────────────────────────
let USER = store.get('user', null);
function renderAuth() {
  $('authBox').innerHTML = USER
    ? `<img class="avatar" src="${esc(USER.picture||'')}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text x=%2250%22 y=%2270%22 font-size=%2280%22 text-anchor=%22middle%22>👤</text></svg>'">
       <span class="uname">${esc(USER.name)}</span>
       <button class="btn btn-ghost btn-sm" onclick="logout()">خروج</button>`
    : `<button class="btn btn-main btn-sm" onclick="showLoginOptions()">🎮 ابدأ اللعب</button>`;
}
function logout() { USER = null; store.set('user', null); renderAuth(); }
function showLoginOptions() {
  modal(`<div class="sec-title">🎮 كيف تريد أن تلعب؟</div>
    <div style="display:flex;gap:12px;margin-top:20px;flex-direction:column">
      <button class="btn btn-main" style="width:100%" onclick="guestLogin()">
        👤 لعب كضيف (Guest)
      </button>
      <button class="btn btn-ghost" style="width:100%;border:1px solid var(--muted)" onclick="showUsernameModal()">
        📝 أدخل اسمك
      </button>
    </div>
    <div style="font-size:13px;color:var(--muted);margin-top:16px;text-align:center;line-height:1.6">
      بيانات لعبك محفوظة محلياً على جهازك 🔒<br>
      آمن تماماً وخصوصي 100%
    </div>`);
}
function guestLogin() {
  USER = { 
    name: 'ضيف ' + Math.floor(Math.random() * 10000),
    id: 'guest_' + Date.now(),
    picture: null,
    isGuest: true
  };
  store.set('user', USER);
  renderAuth();
  closeModal();
  toast('مرحباً بك في خَلّد! 🎉', 'success');
}
function showUsernameModal() {
  modal(`<div class="sec-title">📝 أدخل اسمك</div>
    <input id="usernameInput" type="text" placeholder="اسمك (اختياري)" 
      style="width:100%;padding:12px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font-family:Tajawal,sans-serif;font-size:16px;margin-top:12px;text-align:right" 
      maxlength="30">
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-main" onclick="setUsername()" style="flex:1">موافق ✓</button>
      <button class="btn btn-ghost" onclick="guestLogin()" style="flex:1;border:1px solid var(--muted)">ضيف 👤</button>
    </div>`);
  setTimeout(() => $('usernameInput').focus(), 100);
}
function setUsername() {
  const name = ($('usernameInput').value || 'لاعب').trim();
  USER = { 
    name: name,
    id: 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2,9),
    picture: null,
    isGuest: false
  };
  store.set('user', USER);
  renderAuth();
  closeModal();
  toast(`أهلاً يا ${name}! 👋`, 'success');
}
function googleLogin() { showLoginOptions(); }
renderAuth();

// ─── Leaderboard & Scores ─────────────────────────────────────
function saveScore(gameTitle, winner, scoreVal) {
  try {
    fetch('/api/score', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: gameTitle, name: winner, score: scoreVal, by: USER?.name || null }),
    });
  } catch {}
}
async function openLB() {
  sClick();
  let rows = [];
  try { rows = await (await fetch('/api/leaderboard')).json(); } catch {}
  modal(`<div class="sec-title">🏆 المتصدرون</div>` +
    (rows?.length
      ? rows.map((r, i) =>
          `<div class="lb-row"><span class="rk">${i + 1}</span>${esc(r.name)}
           <span style="color:var(--muted);font-size:12px">${esc(r.game)}</span>
           <span class="sc2">${r.score}</span></div>`).join('')
      : `<div style="color:var(--muted);font-weight:700;text-align:center;padding:20px">
           لا توجد نتائج بعد 🎮</div>`) +
    `<div class="center" style="margin-top:12px">
       <button class="btn btn-main btn-sm" onclick="closeModal()">إغلاق</button></div>`);
}

// ─── قاعدة الأسئلة (DB) ──────────────────────────────────────
let dbPage = 0;
function openDB() {
  sClick();
  $('dbCat').innerHTML = `<option value="">كل الفئات</option>` +
    Object.entries(BANK).map(([k, c]) => `<option value="${k}">${c.ic} ${c.name}</option>`).join('');
  $('aqCat').innerHTML = Object.entries(BANK).map(([k, c]) =>
    `<option value="${k}">${c.ic} ${c.name}</option>`).join('');
  dbPage = 0; renderDB(); show('scr-db');
}
function dbRows() {
  const s = ($('dbSearch').value || '').trim().toLowerCase(),
        cat = $('dbCat').value, lvl = $('dbLvl').value;
  const rows = [];
  for (const [k, c] of Object.entries(BANK)) {
    if (cat && k !== cat) continue;
    for (const q of c.qs) {
      if (lvl && String(q.p) !== lvl) continue;
      if (s && !q.q.toLowerCase().includes(s) && !q.a.toLowerCase().includes(s)) continue;
      rows.push({ k, c, q });
    }
  }
  return rows;
}
function renderDB(append) {
  if (!append) dbPage = 0;
  const rows = dbRows(), page = 60, end = (dbPage + 1) * page;
  $('dbCount').textContent = '(' + rows.length.toLocaleString('ar-EG') + ' سؤال)';
  $('dbList').innerHTML = rows.slice(0, end).map(r =>
    `<div class="qrow"><span class="pts p${r.q.p}">${r.q.p}</span>
      <div class="qq">${esc(r.q.q)}<div class="aa">✅ ${esc(r.q.a)}</div></div>
      <button onclick="shareQImage(decodeURIComponent('${encodeURIComponent(r.q.q)}'),decodeURIComponent('${encodeURIComponent(r.q.a)}'),decodeURIComponent('${encodeURIComponent(r.c.name)}'),'${r.c.ic}')" style="background:none;border:none;cursor:pointer;font-size:18px;padding:4px;color:var(--muted);flex-shrink:0" title="مشاركة كصورة">📤</button>
      <span style="font-size:18px;flex-shrink:0" title="${esc(r.c.name)}">${r.c.ic}</span></div>`
  ).join('') || '<div style="color:var(--muted);text-align:center;padding:20px;font-weight:700">لا نتائج مطابقة</div>';
  $('dbMore').style.display = rows.length > end ? 'inline-block' : 'none';
}
function addCustomQ() {
  const cat = $('aqCat').value, p = $('aqLvl').value;
  const q = $('aqQ').value.trim().slice(0, 400), a = $('aqA').value.trim().slice(0, 200);
  if (!q || !a) { toast('اكتب السؤال والجواب 📝', 'warn'); return; }
  if (q.length < 5) { toast('السؤال قصير جداً', 'warn'); return; }
  BANK[cat].qs.push({ p: +p, q, a });
  const list = store.get('custom_qs', []); list.push({ cat, p, q, a }); store.set('custom_qs', list);
  try {
    fetch('/api/questions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cat, p: +p, q, a, by: USER?.name || null }),
    });
  } catch {}
  $('aqQ').value = ''; $('aqA').value = ''; sAward(); renderDB(); fillStats();
  toast('تم إضافة السؤال بنجاح ✅', 'success');
  trackStat('custom_q_added'); unlockAchievement('addedq');
}

// ─── Mini-games Engine ────────────────────────────────────────
let MG = null, mgTimerInt = null;
function mgTeamsBar() {
  return `<div class="mg-teams">
    <div class="mgt a" onclick="mgRename(0)"><span style="font-size:20px">🟦</span>
      <span class="n" id="mgn0">${esc(MG.teams[0].name)}</span>
      <span class="s" id="mgs0">${MG.teams[0].score}</span></div>
    <div class="mgt b" onclick="mgRename(1)"><span style="font-size:20px">🟪</span>
      <span class="n" id="mgn1">${esc(MG.teams[1].name)}</span>
      <span class="s" id="mgs1">${MG.teams[1].score}</span></div>
  </div>`;
}
function mgRename(i) {
  const n = prompt('اسم الفريق:', MG.teams[i].name);
  if (n) { MG.teams[i].name = n.trim() || MG.teams[i].name; $('mgn'+i).textContent = MG.teams[i].name; if (MG.refresh) MG.refresh(); }
}
function mgShell(title, body, ctrl) {
  $('mgRoot').innerHTML =
    `<div class="mg-top"><button class="btn btn-ghost" onclick="goHub()">⬅ الرئيسية</button>
      <div class="mg-title">${title}</div>
      <button class="btn btn-ghost btn-sm" style="margin-inline-start:auto" onclick="mgEnd()">🏁 إنهاء الجولة</button></div>
    ${mgTeamsBar()}
    <div class="card"><div class="mg-body" id="mgBody">${body}</div>
    <div class="mg-ctrl" id="mgCtrl">${ctrl || ''}</div></div>`;
  show('scr-mg');
}
function mgAward(t, pts) {
  if (t !== null) {
    MG.teams[t].score += pts; sAward();
    const el = $('mgs' + t);
    if (el) { el.textContent = MG.teams[t].score; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  } else sNone();
  clearInterval(mgTimerInt);
  if (MG.next) MG.next();
}
function judge3(pts, label) {
  const p = pts || 1;
  return `<div class="judge3">
    <button class="jj-a" onclick="mgAward(0,${p})">🟦 ${esc(MG.teams[0].name)} ${label || ('+'+p)}</button>
    <button class="jj-b" onclick="mgAward(1,${p})">🟪 ${esc(MG.teams[1].name)} ${label || ('+'+p)}</button>
    <button class="jj-n" onclick="mgAward(null,0)">محد جاوب 😅</button></div>`;
}
function mgRing(sec, onEnd) {
  clearInterval(mgTimerInt);
  let left = sec;
  const html = `<div class="ring" id="mgRing"><svg width="88" height="88">
    <circle cx="44" cy="44" r="37" stroke="#ffffff15" stroke-width="8" fill="none"/>
    <circle id="mgRc" cx="44" cy="44" r="37" stroke="#22d3ee" stroke-width="8" fill="none"
      stroke-linecap="round" stroke-dasharray="233" stroke-dashoffset="0"/>
    </svg><div class="rn" id="mgRn">${sec}</div></div>`;
  setTimeout(() => {
    mgTimerInt = setInterval(() => {
      left--;
      const rn = $('mgRn'), rc = $('mgRc'), rg = $('mgRing');
      if (!rn) { clearInterval(mgTimerInt); return; }
      rn.textContent = left;
      rc.style.strokeDashoffset = 233 * (1 - left / sec);
      const danger = left <= 5;
      rc.setAttribute('stroke', danger ? '#fb7185' : '#22d3ee');
      rg.classList.toggle('danger', danger);
      if (danger && left > 0) sTick();
      if (left <= 0) { clearInterval(mgTimerInt); sBuzz(); if (onEnd) onEnd(); }
    }, 1000);
  }, 50);
  return html;
}
function mgEnd() {
  clearInterval(mgTimerInt);
  const [a, b] = MG.teams;
  const tie = a.score === b.score, w = a.score >= b.score ? a : b;
  if (!tie) saveScore(MG.title, w.name, w.score);
  trackStat('games_played'); if (!tie) { trackStat('games_won'); if (BLITZ_MODE) unlockAchievement('blitz'); }
  const resultText = tie
    ? `تعادل في ${MG.title}! ${a.name}: ${a.score} • ${b.name}: ${b.score}`
    : `${w.name} فاز في ${MG.title} بنتيجة ${w.score} نقطة 🏆`;
  modal(`<div class="winner-pop">
    <span class="t">${tie ? '🤝' : '🏆'}</span>
    <div style="color:var(--muted);font-weight:800">${tie ? 'تعادل!' : 'الفائز'}</div>
    <div class="wn">${tie ? (a.score+' : '+b.score) : esc(w.name)+' 🎉'}</div>
    <div style="font-weight:800;margin:10px 0;color:var(--muted)">${esc(a.name)}: ${a.score} • ${esc(b.name)}: ${b.score}</div>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px">
      <button class="btn btn-main btn-sm" onclick="closeModal();goHub()">🏠 الرئيسية</button>
      <button class="btn btn-ghost btn-sm" onclick="closeModal();mgStart(MG.id)">🔄 جولة جديدة</button>
      <button class="btn btn-ghost btn-sm" onclick="shareResult(MG.title,'${esc(resultText)}')">مشاركة 🎉</button>
    </div>
  </div>`);
  if (!tie) { sWin(); confetti(); }
}
function mgStart(id) {
  sClick();
  const prev = MG && MG.id === id ? MG.teams : null;
  MG = { id, teams: prev || [{ name:'فريق الأزرق', score:0 }, { name:'فريق البنفسجي', score:0 }] };
  GAMES[id].init();
}

// ─── تعريف الألعاب ───────────────────────────────────────────
const GAMES = {};

GAMES.pic = {
  init() { MG.title = '🖼️ تحدي الصور'; MG.tab = 'odd'; this.render(); },
  render() {
    const tabs = `<div class="chipbar">
      <span class="fchip ${MG.tab==='odd'?'onn':''}"   onclick="GAMES.pic.tab('odd')">👀 القط المختلف</span>
      <span class="fchip ${MG.tab==='zoom'?'onn':''}"  onclick="GAMES.pic.tab('zoom')">🔍 اللقطة المقرّبة</span>
      <span class="fchip ${MG.tab==='riddle'?'onn':''}" onclick="GAMES.pic.tab('riddle')">🧠 لغز الإيموجي</span></div>`;
    mgShell(MG.title, tabs + '<div id="picArea"></div>', '');
    MG.refresh = () => this.render();
    this['go_' + MG.tab]();
  },
  tab(t) { sClick(); clearInterval(mgTimerInt); MG.tab = t; this.render(); },
  go_odd() {
    MG.turn = MG.turn ?? 0;
    const [base, odd] = pickNext('pic_odd', GM.pic.odd);
    const pos = Math.floor(Math.random() * 36);
    $('picArea').innerHTML =
      `<div class="midtext" style="padding:8px">دور <b style="color:${MG.turn===0?'var(--cyan)':'var(--pink)'}">${esc(MG.teams[MG.turn].name)}</b>: المسوا الإيموجي المختلف! 👇</div>
       <div class="oddgrid">${Array.from({length:36},(_,i)=>`<button onclick="GAMES.pic.oddTap(${i===pos})">${i===pos?odd:base}</button>`).join('')}</div>`;
    MG.next = () => { MG.turn = 1 - MG.turn; this.go_odd(); };
  },
  oddTap(correct) { correct ? mgAward(MG.turn, 1) : (sBuzz(), mgAward(1 - MG.turn, 1)); },
  go_zoom() {
    const [emo, ans] = pickNext('pic_zoom', GM.pic.zoom);
    MG.zoom = { emo, ans, step: 0, scales: [10,6,3.4,1.4], pts: [4,3,2,1] };
    MG.next = () => this.go_zoom();
    this.drawZoom();
  },
  drawZoom() {
    const z = MG.zoom;
    $('picArea').innerHTML =
      `<div class="midtext" style="padding:8px">وش الشيء؟ النقاط الحالية: <b style="color:var(--amber)">${z.pts[z.step]}</b></div>
       <div class="zoombox"><span style="transform:scale(${z.scales[z.step]})">${z.emo}</span></div>
       <div class="mg-ctrl">
         ${z.step<3?`<button class="btn btn-cyan btn-sm" onclick="GAMES.pic.zoomOut()">🔍 وسّع الرؤية (-1 نقطة)</button>`:''}
         <button class="btn btn-ghost btn-sm" onclick="GAMES.pic.zoomReveal()">اعرض الجواب 👀</button>
       </div>
       <div class="ansbox" id="zAns"></div><div id="zJudge"></div>`;
  },
  zoomOut() { sOpen(); MG.zoom.step++; this.drawZoom(); },
  zoomReveal() {
    sReveal(); $('zAns').textContent = '✅ ' + MG.zoom.ans; $('zAns').style.display = 'block';
    $('zJudge').innerHTML = judge3(MG.zoom.pts[MG.zoom.step]);
  },
  go_riddle() {
    const [emo, ans] = pickNext('pic_riddle', GM.pic.riddle);
    MG.next = () => this.go_riddle();
    $('picArea').innerHTML =
      `<div class="bigword" style="font-size:clamp(50px,12vw,90px);padding:14px">${emo}</div>
       <div class="midtext" style="padding:4px;color:var(--muted);font-size:16px">وش يقصد هالإيموجي؟ 🤔</div>
       ${mgRing(30, () => this.riddleReveal(ans))}
       <div class="mg-ctrl"><button class="btn btn-cyan btn-sm" onclick="GAMES.pic.riddleReveal(decodeURIComponent('${encodeURIComponent(ans)}'))">اعرض الجواب 👀</button></div>
       <div class="ansbox" id="rAns"></div><div id="rJudge"></div>`;
  },
  riddleReveal(ans) {
    clearInterval(mgTimerInt); sReveal();
    $('rAns').textContent = '✅ ' + ans; $('rAns').style.display = 'block';
    $('rJudge').innerHTML = judge3(2);
  },
};

GAMES.let = {
  init() { MG.title = '🔤 الحروف مع أبو خالد'; MG.next = () => this.round(); this.round(); },
  round() {
    mgShell(MG.title,
      `<div class="letterwheel" id="wheel">؟</div>
       <div class="midtext" id="letPrompt" style="min-height:60px;color:var(--muted)">اضغط «لف العجلة» 🎡</div>
       <div id="letTimer"></div><div id="letJudge"></div>`,
      `<button class="btn btn-main" id="spinBtn" onclick="GAMES.let.spin()">🎡 لف العجلة</button>`);
    MG.refresh = () => {};
  },
  spin() {
    sOpen(); $('spinBtn').disabled = true;
    const wheel = $('wheel'); wheel.classList.add('spin');
    const Ls = GM.letters.letters; let i = 0;
    const cyc = setInterval(() => { wheel.textContent = Ls[i++ % Ls.length]; sTick(); }, 70);
    setTimeout(() => {
      clearInterval(cyc); wheel.classList.remove('spin');
      const L = pickNext('let_L', Ls);
      const all = [...GM.letters.normal, ...GM.letters.normal, ...GM.letters.speed];
      const P = pickNext('let_P', all);
      wheel.textContent = L; sReveal();
      $('letPrompt').innerHTML = `<b style="color:var(--amber)">${esc(P)}</b>${P.startsWith('⚡')?'':' يبدأ بحرف'} <b style="color:var(--cyan);font-size:1.3em">(${L})</b>`;
      $('letTimer').innerHTML = mgRing(10, () => { $('letJudge').innerHTML = judge3(1); });
      $('letJudge').innerHTML = judge3(1);
    }, 1400);
  },
};

GAMES.rz = {
  init() { MG.title = '🧩 فوازير'; MG.next = () => this.round(); this.round(); },
  round() {
    const [q, a] = pickNext('rz', GM.riddles);
    mgShell(MG.title,
      `<div class="midtext">${esc(q)}</div>
       ${mgRing(45, () => this.reveal(a))}
       <div class="center"><button class="btn btn-cyan btn-sm" onclick="GAMES.rz.reveal(decodeURIComponent('${encodeURIComponent(a)}'))">اعرض الحل 👀</button></div>
       <div class="ansbox" id="rzAns"></div><div id="rzJudge"></div>`, '');
  },
  reveal(a) {
    clearInterval(mgTimerInt); sReveal();
    $('rzAns').textContent = '✅ ' + a; $('rzAns').style.display = 'block';
    $('rzJudge').innerHTML = judge3(1);
  },
};

GAMES.feud = {
  init() { MG.title = '📊 فاميلي فيود'; MG.next = () => this.round(); this.round(); },
  round() {
    const [q, answers] = pickNext('feud', GM.feud);
    MG.feud = { answers, open: [], strikes: 0 };
    mgShell(MG.title,
      `<div class="midtext" style="padding-bottom:8px">${esc(q)}</div>
       <div style="text-align:center;color:var(--muted);font-weight:800;font-size:13px;margin-bottom:10px">المقدّم يقلب البطاقة إذا انذكرت إجابتها 👇</div>
       <div class="feudgrid">${answers.map((a,i)=>`
         <div class="fcard" id="fc${i}" onclick="GAMES.feud.flip(${i})"><div class="fin">
           <div class="fface ff">${i+1}</div>
           <div class="fface fb"><span>${esc(a[0])}</span><b>${a[1]}</b></div>
         </div></div>`).join('')}</div>
       <div class="strikes">${[0,1,2].map(i=>`<div class="strike" id="st${i}" onclick="GAMES.feud.strike(${i})">❌</div>`).join('')}</div>
       <div class="midtext" style="font-size:18px;padding:4px">نقاط الجولة: <b id="fpts" style="color:var(--amber)">0</b></div>
       <div class="judge3">
         <button class="jj-a" onclick="GAMES.feud.give(0)">🟦 الجولة لـ ${esc(MG.teams[0].name)}</button>
         <button class="jj-b" onclick="GAMES.feud.give(1)">🟪 الجولة لـ ${esc(MG.teams[1].name)}</button>
         <button class="jj-n" onclick="mgAward(null,0)">سؤال جديد ⏭</button></div>`, '');
  },
  flip(i) {
    const f = MG.feud; if (f.open.includes(i)) return;
    f.open.push(i); $('fc'+i).classList.add('flipped'); sAward();
    $('fpts').textContent = f.open.reduce((s, x) => s + f.answers[x][1], 0);
  },
  strike(i) { const el = $('st'+i); if (!el.classList.contains('onn')) { el.classList.add('onn'); sBuzz(); } },
  give(t) { const pts = MG.feud.open.reduce((s,x) => s + MG.feud.answers[x][1], 0); mgAward(t, pts||0); },
};

GAMES.wb = {
  init() { MG.title = '🎭 بنك الكلمات'; MG.type = 'أشياء'; MG.lvl = 'متوسط'; MG.mode = 'تمثيل'; MG.next = () => this.draw(); this.render(); },
  render() {
    const types = Object.keys(GM.words);
    mgShell(MG.title,
      `<div class="chipbar">${['تمثيل 🎭','رسم ✏️','شرح 🗣️'].map(m=>`<span class="fchip ${MG.mode===m.split(' ')[0]?'onn':''}" onclick="GAMES.wb.set('mode','${m.split(' ')[0]}')">${m}</span>`).join('')}</div>
       <div class="chipbar">${types.map(t=>`<span class="fchip ${MG.type===t?'onn':''}" onclick="GAMES.wb.set('type','${t}')">${t}</span>`).join('')}</div>
       <div class="chipbar">${['سهل','متوسط','صعب'].map(l=>`<span class="fchip ${MG.lvl===l?'onn':''}" onclick="GAMES.wb.set('lvl','${l}')">${l} ${l==='سهل'?'+1':l==='متوسط'?'+2':'+3'}</span>`).join('')}</div>
       <div id="wbArea" class="center" style="padding-top:6px;color:var(--muted);font-weight:800">اسحب بطاقة وابدأ! 🃏</div>`,
      `<button class="btn btn-main" onclick="GAMES.wb.draw()">🃏 اسحب بطاقة</button>`);
    MG.refresh = () => this.render();
  },
  set(k, v) { sClick(); MG[k] = v; clearInterval(mgTimerInt); this.render(); },
  draw() {
    const pool = GM.words[MG.type][MG.lvl];
    const w = pickNext('wb_'+MG.type+'_'+MG.lvl, pool);
    const pts = MG.lvl==='سهل'?1:MG.lvl==='متوسط'?2:3;
    $('wbArea').innerHTML =
      `<div style="color:var(--muted);font-weight:800;font-size:14px">${esc(MG.mode)} • ${esc(MG.type)} • ${esc(MG.lvl)}</div>
       <div class="bigword">${esc(w)}</div>
       ${mgRing(60, () => {})}
       ${judge3(pts)}`;
  },
};

GAMES.who = {
  init() { MG.title = '🕵️ من أنا؟'; MG.next = () => this.round(); this.round(); },
  round() {
    const [name, hints] = pickNext('who', GM.who);
    MG.who = { name, hints, shown: 1 };
    mgShell(MG.title,
      `<div class="midtext" style="padding:6px;font-size:18px;color:var(--muted)">تلميحات من الأصعب للأسهل — النقاط الحالية: <b id="whoPts" style="color:var(--amber)">6</b></div>
       <div id="whoHints"></div>
       <div class="mg-ctrl">
         <button class="btn btn-cyan btn-sm" id="whoMore" onclick="GAMES.who.more()">💡 تلميح إضافي (-1)</button>
         <button class="btn btn-ghost btn-sm" onclick="GAMES.who.reveal()">من هو؟ 👀</button>
       </div>
       <div class="ansbox" id="whoAns"></div><div id="whoJudge"></div>`, '');
    this.draw();
  },
  draw() {
    const w = MG.who;
    $('whoHints').innerHTML = w.hints.slice(0, w.shown).map((h,i) => `<div class="hintline"><b>${i+1}</b>${esc(h)}</div>`).join('');
    $('whoPts').textContent = 7 - w.shown;
    if (w.shown >= 6) $('whoMore').style.display = 'none';
  },
  more() { sOpen(); MG.who.shown++; this.draw(); },
  reveal() {
    sReveal(); $('whoAns').textContent = '✅ ' + MG.who.name; $('whoAns').style.display = 'block';
    $('whoJudge').innerHTML = judge3(7 - MG.who.shown);
  },
};

GAMES.wf = {
  init() { MG.title = '⚡ من الشخصية؟'; MG.next = () => this.round(); this.round(); },
  round() {
    const [name, hints] = pickNext('wf', GM.whofast);
    mgShell(MG.title,
      `${hints.map((h,i) => `<div class="hintline"><b>${i+1}</b>${esc(h)}</div>`).join('')}
       ${mgRing(15, () => this.reveal(name))}
       <div class="center"><button class="btn btn-cyan btn-sm" onclick="GAMES.wf.reveal(decodeURIComponent('${encodeURIComponent(name)}'))">الجواب 👀</button></div>
       <div class="ansbox" id="wfAns"></div><div id="wfJudge"></div>`, '');
  },
  reveal(name) {
    clearInterval(mgTimerInt); sReveal();
    $('wfAns').textContent = '✅ ' + name; $('wfAns').style.display = 'block';
    $('wfJudge').innerHTML = judge3(1);
  },
};

GAMES.fast = {
  init() { MG.title = '🏁 مين أسرع واحد؟'; MG.next = () => this.round(); this.round(); },
  round() {
    const cmd = pickNext('fast', GM.fast);
    mgShell(MG.title,
      `<div class="bigword" style="font-size:clamp(24px,5.5vw,42px)">${esc(cmd)}</div>
       ${mgRing(8, () => {})}
       ${judge3(1)}`,
      `<button class="btn btn-ghost btn-sm" onclick="mgAward(null,0)">⏭ أمر جديد</button>`);
    sOpen();
  },
};

// ─── سين جيم ─────────────────────────────────────────────────
const TIME  = 60;
const LIFES = { dbl:'✕2 دبل', blk:'🚫 حظر الخصم', swap:'🎲 بدّل السؤال', time:'⏱️ +30 ثانية' };
let SJMODE = 'local', game = null;
let net = { ws: null, code: null, guestName: null, connected: false };
let sel = [];
let BLITZ_MODE = false, aiEnabled = false;

function chooseMode(m) {
  sClick(); SJMODE = m;
  if (m === 'guest') { show('scr-join'); return; }
  $('t1wrap').style.display    = m === 'host' ? 'none'  : 'block';
  $('hostHint').style.display  = m === 'host' ? 'block' : 'none';
  renderCats(); show('scr-setup');
}
function renderCats() {
  $('catGrid').innerHTML = Object.entries(BANK).map(([k, c]) =>
    `<div class="cat ${sel.includes(k)?'sel':''}" id="cat-${k}" onclick="toggleCat('${k}')">
      <span class="ic">${c.ic}</span>${esc(c.name)}<span class="cnt">${c.qs.length} سؤال</span></div>`).join('');
  $('catCount').textContent = sel.length; $('startBtn').disabled = sel.length !== 6;
}
function toggleCat(k) {
  sClick();
  if (sel.includes(k)) sel = sel.filter(x => x !== k);
  else if (sel.length < 6) sel.push(k);
  $('cat-'+k).classList.toggle('sel', sel.includes(k));
  $('catCount').textContent = sel.length; $('startBtn').disabled = sel.length !== 6;
}
function dealQuestions(ids) {
  const deal = {}, used = store.get('u_sj', {});
  for (const k of ids) {
    used[k] = used[k] || [];
    const tier = p => {
      let pool = BANK[k].qs.filter(q => q.p === p && !used[k].includes(q.q));
      if (pool.length < 2) { used[k] = used[k].filter(t => !BANK[k].qs.some(q => q.p===p&&q.q===t)); pool = BANK[k].qs.filter(q => q.p===p); }
      return shuffle(pool).slice(0, 2);
    };
    deal[k] = [...tier(200), ...tier(400), ...tier(600)];
    deal[k].forEach(q => used[k].push(q.q));
  }
  store.set('u_sj', used);
  return deal;
}
function freshLifes() { return { dbl:true, blk:true, swap:true, time:true }; }
function setupDone() {
  if (SJMODE === 'local') {
    buildGame($('tname0').value.trim()||'الفريق الأول', $('tname1').value.trim()||'الفريق الثاني');
    render();
  } else if (SJMODE === 'host') { createRoom(); }
}
function buildGame(n0, n1) {
  game = {
    phase: 'board', sel: [...sel], deal: dealQuestions(sel),
    teams: [{ name:n0, score:0, lifes:freshLifes() }, { name:n1, score:0, lifes:freshLifes() }],
    used: [], turn: 0, act: null,
  };
}

// ─── WebSocket + Online ───────────────────────────────────────
function wsURL(code, role, name) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/api/room/${code}/ws?role=${role}&name=${encodeURIComponent(name)}`;
}
function setNet(ok, txt) {
  $('netbar').style.display = 'flex';
  $('netdot').classList.toggle('bad', !ok);
  $('nettxt').textContent = txt;
}
function makeCode() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join('');
}

let _wsRetry = 0, _wsRetryT = null;
function connectWS(wsUrl, onOpen, onMsgCb, onClose) {
  clearTimeout(_wsRetryT);
  const ws = new WebSocket(wsUrl);
  ws.onopen    = () => { _wsRetry = 0; onOpen(ws); };
  ws.onmessage = onMsgCb;
  ws.onclose   = () => {
    onClose(false);
    if (_wsRetry < 4) {
      const delay = Math.min(1000 * Math.pow(2, _wsRetry), 15000);
      _wsRetry++;
      setNet(false, 'إعادة الاتصال... (' + _wsRetry + ')');
      _wsRetryT = setTimeout(() => connectWS(wsUrl, onOpen, onMsgCb, onClose), delay);
    } else { setNet(false, 'انقطع الاتصال نهائياً'); }
  };
  return ws;
}

function createRoom() {
  net.code = makeCode();
  const name = $('tname0').value.trim() || 'فريق المضيف';
  const url  = wsURL(net.code, 'host', name);
  net.ws = connectWS(url,
    ws => { net.ws = ws; net.connected = true; setNet(true, 'متصل • ' + net.code); },
    onMsg, () => { net.connected = false; });
  $('roomCode').textContent = net.code;
  $('lobbyPlayers').innerHTML = `<div class="lp">🟦 ${esc(name)}<span class="role">المضيف</span></div>`;
  show('scr-lobby');
}
function copyCode() {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(net.code).then(() => toast('تم نسخ الكود ✓', 'success', 2000));
  } else { toast(net.code, 'info'); }
  sClick();
}
function joinRoom() {
  const code = $('gcode').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const name = $('gname').value.trim() || 'فريق الضيف';
  if (code.length < 4) { toast('اكتب كود الغرفة كاملاً (4 أحرف)', 'err'); return; }
  net.code = code;
  const url = wsURL(code, 'guest', name);
  net.ws = connectWS(url,
    ws => { net.ws = ws; net.connected = true; setNet(true, 'متصل • ' + code); },
    onMsg, () => { net.connected = false; });
  $('waitCode').textContent = code;
  show('scr-wait');
}
function onMsg(ev) {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.t === 'welcome' && SJMODE === 'guest' && m.game) { game = m.game; render(); }
  if (m.t === 'players' && SJMODE === 'host') {
    const g = m.players.find(p => p.role === 'guest');
    net.guestName = g ? g.name : null;
    const hostName = $('tname0').value.trim() || 'فريق المضيف';
    $('lobbyPlayers').innerHTML =
      `<div class="lp">🟦 ${esc(hostName)}<span class="role">المضيف</span></div>` +
      (g ? `<div class="lp">🟪 ${esc(g.name)}<span class="role">انضم ✓</span></div>`
         : `<div class="lp" style="opacity:.55">⏳ بانتظار المنافس...<span class="role">—</span></div>`);
    $('hostStartBtn').disabled = !g;
    if (g) sAward();
  }
  if (m.t === 'state') { game = m.game; render(); }
  if (m.t === 'act' && SJMODE === 'host') applyGuestAction(m.action);
  if (m.t === 'hostLeft')  { toast('المضيف غادر الغرفة 😢', 'warn'); setTimeout(goHub, 2000); }
  if (m.t === 'guestLeft' && SJMODE === 'host') { setNet(false, 'المنافس غادر'); toast('المنافس غادر الغرفة', 'warn'); }
  if (m.t === 'err') { toast(m.m || 'خطأ غير معروف', 'err'); setTimeout(goHub, 2500); }
}
function pushState() { if (SJMODE === 'host' && net.connected) net.ws.send(JSON.stringify({ t:'state', game })); }
function hostStart() {
  buildGame($('tname0').value.trim()||'فريق المضيف', net.guestName||'فريق الضيف');
  pushState(); render(); sAward();
}
function myTeam()      { return SJMODE === 'guest' ? 1 : 0; }
function isOperator()  { return SJMODE !== 'guest'; }
function dispatch(action) {
  if (!game) return;
  if (SJMODE === 'guest') {
    if ((action.a === 'pick' || action.a === 'life') && game.turn === 1)
      net.ws.send(JSON.stringify({ t:'act', action }));
    return;
  }
  applyAction(action, 0);
}
function applyGuestAction(action) {
  if (game && game.turn === 1 && (action.a === 'pick' || action.a === 'life'))
    applyAction(action, 1);
}
function applyAction(action, who) {
  const g = game;
  if (action.a === 'pick' && g.phase === 'board' && !g.act) {
    if (SJMODE !== 'local' && who !== g.turn) return;
    const key = action.k + '-' + action.qi;
    if (g.used.includes(key)) return;
    g.act = { k:action.k, qi:action.qi, revealed:false, qStart:Date.now(), dbl:false, blk:false, extra:0 };
    sOpen();
  } else if (action.a === 'life' && g.act && !g.act.revealed) {
    if (SJMODE !== 'local' && who !== g.turn) return;
    const t = g.teams[g.turn], lt = action.lt;
    if (!t.lifes[lt]) return;
    t.lifes[lt] = false;
    if (lt === 'dbl')  g.act.dbl = true;
    if (lt === 'blk')  g.act.blk = true;
    if (lt === 'time') g.act.extra += 30;
    if (lt === 'swap') {
      const cur = g.deal[g.act.k][g.act.qi];
      const pool = BANK[g.act.k].qs.filter(q => q.p === cur.p && q.q !== cur.q);
      if (pool.length) g.deal[g.act.k][g.act.qi] = pool[Math.floor(Math.random()*pool.length)];
      g.act.qStart = Date.now(); g.act.extra = 0; sSwap();
    } else sOpen();
  } else if (action.a === 'reveal' && g.act && !g.act.revealed) {
    g.act.revealed = true; sReveal();
  } else if (action.a === 'award' && g.act && g.act.revealed) {
    const q = g.deal[g.act.k][g.act.qi];
    if (action.w !== null && action.w !== undefined && !(g.act.blk && action.w !== g.turn)) {
      let pts = q.p; if (g.act.dbl && action.w === g.turn) pts *= 2;
      g.teams[action.w].score += pts; sAward();
    } else if (action.w === null) sNone();
    g.used.push(g.act.k + '-' + g.act.qi);
    g.act = null; g.turn = 1 - g.turn;
    if (g.used.length >= g.sel.length * 6) g.phase = 'end';
  }
  pushState(); render();
}

// ─── Render ───────────────────────────────────────────────────
function render() {
  if (!game) return;
  if (game.phase === 'end') { renderEnd(); return; }
  if (game.act) renderQ(); else renderBoard();
}
function renderBoard() {
  const g = game;
  [0, 1].forEach(i => {
    $('hn'+i).textContent = (i===0?'🟦 ':'🟪 ') + g.teams[i].name;
    $('hs'+i).textContent = g.teams[i].score;
    $('card'+i).classList.toggle('turn', g.turn===i);
    $('lifes'+i).innerHTML = Object.entries(LIFES).map(([lt, lbl]) =>
      `<button class="life ${g.teams[i].lifes[lt]?'':'used'}" title="تُستخدم أثناء السؤال">${lbl}</button>`).join('');
  });
  const myTurn = SJMODE === 'local' || g.turn === myTeam();
  $('turnBanner').innerHTML = myTurn
    ? `الدور على <b style="color:${g.turn===0?'var(--cyan)':'var(--pink)'}">${esc(g.teams[g.turn].name)}</b> — اختاروا سؤالاً 👇`
    : `⏳ الدور على <b style="color:${g.turn===0?'var(--cyan)':'var(--pink)'}">${esc(g.teams[g.turn].name)}</b> — انتظروا اختيارهم`;
  $('board').innerHTML = g.sel.map(k => {
    const c = BANK[k];
    const btns = g.deal[k].map((q, i) => {
      const done = g.used.includes(k+'-'+i), dis = done || !myTurn;
      return `<button class="pt v${q.p} ${done?'done':(!myTurn?'lockturn':'')}" ${dis?'disabled':''}
        onclick="dispatch({a:'pick',k:'${k}',qi:${i}})">${done?'✓':q.p}</button>`;
    }).join('');
    return `<div class="brow"><div class="bcat"><span class="ic">${c.ic}</span>${esc(c.name)}</div><div class="bpts">${btns}</div></div>`;
  }).join('');
  show('scr-board');
}
function renderQ() {
  const g = game, q = g.deal[g.act.k][g.act.qi];
  $('qCat').textContent  = BANK[g.act.k].ic + ' ' + BANK[g.act.k].name;
  $('qPts').textContent  = '⭐ ' + q.p + ' نقطة';
  $('qText').textContent = q.q;
  $('qDbl').style.display = g.act.dbl    ? 'inline-block' : 'none';
  $('qBlk').style.display = g.act.blk    ? 'inline-block' : 'none';
  $('qXt').style.display  = g.act.extra>0? 'inline-block' : 'none';
  const canLife = !g.act.revealed && (SJMODE === 'local' || g.turn === myTeam());
  const t = g.teams[g.turn];
  $('qLifes').innerHTML = !canLife ? '' : Object.entries(LIFES).map(([lt, lbl]) =>
    `<button class="life ${t.lifes[lt]?'':'used'}" ${t.lifes[lt]?'':'disabled'} onclick="dispatch({a:'life',lt:'${lt}'})">${lbl}</button>`).join('');
  $('guestNote').style.display = SJMODE === 'guest' ? 'block' : 'none';
  $('revealBtn').style.display = (!g.act.revealed && isOperator()) ? 'inline-block' : 'none';
  const _vb = $('voiceBtn');
  if (_vb) _vb.style.display = (!g.act.revealed && (window.SpeechRecognition || window.webkitSpeechRecognition)) ? 'inline-block' : 'none';
  if (g.act.revealed) {
    $('qAns').textContent = '✅ ' + q.a; $('qAns').style.display = 'block';
    if (isOperator()) {
      $('j0').textContent = '🟦 ' + g.teams[0].name + ' جاوب';
      $('j1').textContent = '🟪 ' + g.teams[1].name + ' جاوب';
      $('j'+(1-g.turn)).disabled = g.act.blk;
      $('j'+g.turn).disabled = false;
      $('judge').style.display = 'grid';
    } else $('judge').style.display = 'none';
  } else { $('qAns').style.display = 'none'; $('judge').style.display = 'none'; }
  show('scr-q');
}
function renderEnd() {
  const [a, b] = game.teams;
  $('fn0').textContent = a.name; $('fs0').textContent = a.score;
  $('fn1').textContent = b.name; $('fs1').textContent = b.score;
  if (a.score === b.score) {
    $('endIcon').textContent = '🤝'; $('endLabel').textContent = 'النتيجة'; $('winnerName').textContent = 'تعادل!';
  } else {
    const w = a.score > b.score ? a : b;
    $('endIcon').textContent = '🏆'; $('endLabel').textContent = 'الفريق الفائز'; $('winnerName').textContent = w.name + ' 🎉';
    saveScore('سين جيم', w.name, w.score);
    // زر المشاركة
    const shareBtn = document.createElement('button');
    shareBtn.className = 'btn btn-ghost btn-sm';
    shareBtn.style.marginTop = '10px';
    shareBtn.textContent = 'شارك النتيجة 🎉';
    shareBtn.onclick = () => shareResult('سين جيم', `${w.name} فاز في سين جيم بنتيجة ${w.score} نقطة ضد ${(w===a?b:a).name} (${(w===a?b:a).score} نقطة) 🧠🏆`);
    $('scr-end').querySelector('.winner-box')?.appendChild(shareBtn);
  }
  trackStat('games_played'); if (a.score !== b.score) { trackStat('games_won'); if (BLITZ_MODE) unlockAchievement('blitz'); }
  show('scr-end'); sWin(); confetti();
}

// ─── مؤقت السؤال ─────────────────────────────────────────────
let lastTick = -1;
setInterval(() => {
  const g = game;
  if (!g || !g.act || g.act.revealed || !$('scr-q').classList.contains('on')) return;
  const limit = (BLITZ_MODE ? 10 : TIME) + (g.act.extra || 0);
  const left  = Math.max(0, Math.ceil(limit - (Date.now() - g.act.qStart) / 1000));
  $('tNum').textContent = left;
  $('tRing').style.strokeDashoffset = 302 * (1 - left / limit);
  const danger = left <= 10;
  $('tRing').setAttribute('stroke', danger ? '#fb7185' : '#22d3ee');
  $('timerBox').classList.toggle('danger', danger);
  if (danger && left !== lastTick && left > 0) sTick();
  lastTick = left;
  if (left <= 0 && isOperator()) applyAction({ a:'reveal' }, 0);
}, 250);

// ─── تسجيل Service Worker ─────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(r => console.log('SW registered:', r.scope))
      .catch(e => console.log('SW error:', e));
  });
}

// ═══════════════════════════════════════════════════════════════
// الميزات الاحترافية v4.0
// ═══════════════════════════════════════════════════════════════

// ─── إحصائيات اللاعب ─────────────────────────────────────────
function trackStat(key, delta = 1) {
  const s = store.get('stats', {});
  s[key] = (s[key] || 0) + delta;
  store.set('stats', s);
  if (key === 'games_played' && s[key] >= 10) unlockAchievement('played10');
  if (key === 'games_won'    && s[key] >= 5)  unlockAchievement('won5');
}
function openStats() {
  sClick();
  const s = store.get('stats', {});
  const unlockedCount = Object.keys(store.get('achievements', {})).length;
  const name = USER ? USER.name : 'لاعب';
  const rows = [
    ['🎮','الجولات المُلعبة',       s.games_played||0],
    ['🏆','الانتصارات',              s.games_won||0],
    ['📅','التحديات اليومية',        s.daily_done||0],
    ['🏅','الإنجازات المفتوحة',      unlockedCount+'/'+Object.keys(ACHIEVEMENTS).length],
    ['📝','الأسئلة المُضافة',        s.custom_q_added||0],
    ['🎤','مرات الإجابة بالصوت',    s.voice_used||0],
    ['📤','صور السؤال المُشاركة',   s.images_shared||0],
  ];
  modal('<div style="text-align:center;margin-bottom:16px">'+
    '<div style="font-size:52px;margin-bottom:8px">👤</div>'+
    '<div style="font-family:Lalezar;font-size:26px">'+esc(name)+'</div>'+
    (USER&&USER.isGuest?'<div style="font-size:12px;color:var(--muted);font-weight:700">ضيف</div>':'')+
    '</div>'+
    '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">'+
    rows.map(([ic,label,val])=>
      '<div style="display:flex;align-items:center;gap:12px;background:rgba(21,11,51,.9);border-radius:12px;padding:12px 15px;border:1px solid rgba(255,255,255,.08)">'+
      '<span style="font-size:22px">'+ic+'</span>'+
      '<span style="font-weight:800;font-size:14px;flex:1">'+label+'</span>'+
      '<span style="font-family:Lalezar;font-size:22px;color:var(--amber)">'+val+'</span></div>'
    ).join('')+
    '</div>'+
    '<div style="display:flex;gap:8px;justify-content:center">'+
    '<button class="btn btn-ghost btn-sm" onclick="openAchievements()">🏅 الإنجازات</button>'+
    '<button class="btn btn-ghost btn-sm" onclick="closeModal()">إغلاق</button></div>');
}

// ─── الإنجازات والشارات ───────────────────────────────────────
const ACHIEVEMENTS = {
  daily:    { ic:'📅', name:'ملتزم',     desc:'أجبت على تحدي يومي' },
  played10: { ic:'🎮', name:'لاعب نشط',  desc:'لعبت 10 جولات' },
  won5:     { ic:'🏆', name:'بطل',        desc:'فزت في 5 جولات' },
  addedq:   { ic:'✍️', name:'مساهم',    desc:'أضفت سؤالاً للقاعدة' },
  shared:   { ic:'📤', name:'مشارك',     desc:'شاركت صورة سؤال' },
  voice:    { ic:'🎤', name:'صوتي',       desc:'أجبت بصوتك' },
  blitz:    { ic:'⚡', name:'برق',         desc:'فزت في وضع البليتز' },
  allgames: { ic:'🌟', name:'موسوعي',    desc:'جربت كل الألعاب التسع' },
  streak3:  { ic:'🔥', name:'مثابر',      desc:'فتحت تحدي 3 أيام متتالية' },
  qr:       { ic:'📱', name:'تقني',       desc:'استخدمت QR للانضمام' },
};
function unlockAchievement(id) {
  const got = store.get('achievements', {});
  if (got[id]) return;
  got[id] = Date.now();
  store.set('achievements', got);
  const a = ACHIEVEMENTS[id];
  if (!a) return;
  const el = document.createElement('div');
  el.className = 'ach-notif';
  el.innerHTML = '<div style="font-size:11px;font-weight:800;color:var(--mag);letter-spacing:.5px;margin-bottom:3px">🏅 إنجاز جديد!</div>'+
    '<div style="font-weight:800;font-size:15px">'+a.ic+' '+a.name+'</div>'+
    '<div style="font-size:12px;color:var(--muted);font-weight:700;margin-top:2px">'+a.desc+'</div>';
  document.body.appendChild(el);
  sAward();
  setTimeout(() => { el.style.opacity='0'; setTimeout(()=>el.remove(),400); }, 4500);
}
function openAchievements() {
  sClick();
  const got = store.get('achievements', {});
  const cards = Object.entries(ACHIEVEMENTS).map(([id, a]) => {
    const have = !!got[id];
    return '<div style="background:rgba(21,11,51,'+(have?'.9':'.4')+');border:1px solid rgba(255,255,255,'+(have?'.18':'.06')+');border-radius:14px;padding:14px;'+(have?'':'opacity:.5;')+'">'+
      '<div style="font-size:28px;margin-bottom:5px">'+a.ic+'</div>'+
      '<div style="font-weight:800;font-size:13px">'+a.name+'</div>'+
      '<div style="font-size:11px;color:var(--muted);font-weight:700;margin-top:2px">'+a.desc+'</div>'+
      (have?'<div style="font-size:10px;color:var(--grn);font-weight:800;margin-top:4px">✅ مفتوح</div>':'')+
      '</div>';
  }).join('');
  modal('<div class="sec-title">🏅 الإنجازات والشارات</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+cards+'</div>'+
    '<div style="text-align:center;margin-top:12px"><button class="btn btn-ghost btn-sm" onclick="closeModal()">إغلاق</button></div>');
}

// ─── التحدي اليومي ───────────────────────────────────────────
function _getDailyQ() {
  const today = new Date().toISOString().slice(0, 10);
  let h = 0;
  for (const c of today) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  const cats = Object.values(BANK).filter(c => c.qs.length > 0);
  if (!cats.length) return null;
  const cat = cats[Math.abs(h) % cats.length];
  const q   = cat.qs[Math.abs(h * 17) % cat.qs.length];
  return { today, cat, q };
}
function openDailyChallenge() {
  sClick();
  const d = _getDailyQ();
  if (!d) { toast('لا توجد أسئلة متاحة', 'warn'); return; }
  const { today, cat, q } = d;
  const done = store.get('daily_' + today, false);
  const lvl = { 200:'سهل', 400:'متوسط', 600:'صعب' };
  modal(
    '<div style="text-align:center;margin-bottom:12px">'+
    '<div style="font-size:48px">📅</div>'+
    '<div class="sec-title" style="justify-content:center;margin-bottom:4px">تحدي اليوم</div>'+
    '<div style="font-size:12px;color:var(--muted);font-weight:700">'+today+'</div></div>'+
    '<div style="background:rgba(21,11,51,.9);border-radius:16px;padding:18px;border:1px solid rgba(255,255,255,.13);margin-bottom:16px">'+
    '<div style="font-size:13px;font-weight:800;color:var(--muted);margin-bottom:8px">'+cat.ic+' '+esc(cat.name)+' • '+(lvl[q.p]||'')+'</div>'+
    '<div style="font-size:clamp(17px,3.4vw,22px);font-weight:800;line-height:1.7">'+esc(q.q)+'</div></div>'+
    '<div id="_dailyAns">'+
    (done
      ? '<div style="background:rgba(6,48,42,.9);border:1.5px solid rgba(52,211,153,.5);border-radius:14px;padding:14px;text-align:center;font-weight:800;color:var(--grn);font-size:18px">✅ '+esc(q.a)+'</div>'+
        '<div style="text-align:center;margin-top:10px;color:var(--muted);font-size:13px;font-weight:700">أجبت على تحدي اليوم ✓</div>'
      : '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">'+
        '<button class="btn btn-main" onclick="_doRevealDaily()">اعرف الجواب 👀</button>'+
        '<button class="btn btn-ghost" onclick="closeModal()">لاحقاً ⏰</button></div>')+
    '</div>'+
    '<div style="text-align:center;margin-top:12px">'+
    '<button class="btn btn-ghost btn-sm" onclick="shareResult(\'تحدي اليوم\',\''+esc(q.q)+'\')">📤 شارك السؤال</button></div>'
  );
}
function _doRevealDaily() {
  const d = _getDailyQ(); if (!d) return;
  const { today, q } = d;
  store.set('daily_' + today, true);
  trackStat('daily_done'); unlockAchievement('daily');
  _checkDailyStreak();
  _updateDailyBtn();
  const el = $('_dailyAns');
  if (el) el.innerHTML = '<div style="background:rgba(6,48,42,.9);border:1.5px solid rgba(52,211,153,.5);border-radius:14px;padding:14px;text-align:center;font-weight:800;color:var(--grn);font-size:18px">✅ '+esc(q.a)+'</div>'+
    '<div style="text-align:center;margin-top:10px"><button class="btn btn-ghost btn-sm" onclick="closeModal()">أحسنت! 🎉</button></div>';
  sAward();
}
function _checkDailyStreak() {
  const streak = store.get('daily_streak', { count:0, last:'' });
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (streak.last === yesterday) { streak.count++; }
  else if (streak.last !== today) { streak.count = 1; }
  streak.last = today;
  store.set('daily_streak', streak);
  if (streak.count >= 3) unlockAchievement('streak3');
}
function _updateDailyBtn() {
  const today = new Date().toISOString().slice(0, 10);
  const done  = store.get('daily_' + today, false);
  const btn   = $('dailyBtn'); if (!btn) return;
  btn.textContent = done ? '📅 تحدي اليوم ✓' : '📅 تحدي اليوم!';
  if (done) { btn.className = 'btn btn-ghost done-daily'; btn.style.background = ''; }
  else      { btn.className = 'btn btn-main'; btn.style.background = ''; }
}
_updateDailyBtn();

// ─── وضع البليتز ─────────────────────────────────────────────
function toggleBlitz() {
  BLITZ_MODE = !BLITZ_MODE;
  const btn = $('blitzToggle'); if (!btn) return;
  btn.textContent = BLITZ_MODE ? '⚡ بليتز: شغّال' : '⚡ وضع البليتز';
  btn.className   = 'btn ' + (BLITZ_MODE ? 'btn-main' : 'btn-ghost');
  btn.style.background = BLITZ_MODE ? 'linear-gradient(112deg,#92400e,#b45309)' : '';
  toast(BLITZ_MODE ? '⚡ وضع البليتز: 10 ثوانٍ فقط للسؤال!' : '⏱️ العودة للوضع العادي (60 ثانية)', BLITZ_MODE ? 'warn' : 'info');
}

// ─── التعرف على الصوت ────────────────────────────────────────
const _SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let _voiceRec = null, _voiceActive = false;
function startVoice() {
  if (!_SR) { toast('متصفحك لا يدعم الإجابة بالصوت 😔', 'warn'); return; }
  if (_voiceActive) { try { _voiceRec && _voiceRec.stop(); } catch {} return; }
  _voiceRec = new _SR();
  _voiceRec.lang = 'ar-SA';
  _voiceRec.interimResults = false;
  _voiceRec.maxAlternatives = 3;
  _voiceActive = true;
  const btn = $('voiceBtn');
  if (btn) btn.textContent = '🔴 جاري الاستماع... (اضغط لإيقاف)';
  _voiceRec.onresult = ev => {
    const text = Array.from(ev.results).map(r => r[0].transcript).join(' ');
    _voiceActive = false;
    if (btn) btn.textContent = '🎤 جواب بالصوت';
    toast('سمعت: "'+text+'"', 'info', 4000);
    unlockAchievement('voice'); trackStat('voice_used');
  };
  _voiceRec.onerror = () => {
    _voiceActive = false;
    if (btn) btn.textContent = '🎤 جواب بالصوت';
    toast('لم أسمع شيئاً، حاول مجدداً 🎤', 'warn');
  };
  _voiceRec.onend = () => { _voiceActive = false; if (btn) btn.textContent = '🎤 جواب بالصوت'; };
  try { _voiceRec.start(); } catch { _voiceActive = false; }
}

// ─── QR Code للغرفة ──────────────────────────────────────────
function showRoomQR() {
  if (!net.code) { toast('لا توجد غرفة نشطة', 'warn'); return; }
  sClick();
  const code = net.code;
  const joinUrl = location.origin + location.pathname + '?join=' + code;
  modal(
    '<div class="sec-title" style="justify-content:center">📱 QR انضمام سريع</div>'+
    '<div style="text-align:center;padding:8px">'+
    '<div style="background:#fff;display:inline-block;border-radius:12px;padding:10px;margin-bottom:12px">'+
    '<canvas id="_qrC" width="180" height="180"></canvas></div>'+
    '<div style="color:var(--muted);font-weight:800;font-size:12px;margin-bottom:8px">امسح الكود بكاميرا الجوال للانضمام مباشرة</div>'+
    '<div style="font-family:Lalezar;font-size:36px;color:var(--amber);letter-spacing:8px">'+code+'</div></div>'+
    '<div style="text-align:center;margin-top:10px"><button class="btn btn-ghost btn-sm" onclick="closeModal()">إغلاق</button></div>'
  );
  setTimeout(() => _renderQR($('_qrC'), joinUrl), 60);
}
function _renderQR(canvas, text) {
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => canvas.getContext('2d').drawImage(img, 0, 0, 180, 180);
  img.onerror = () => {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 180, 180);
    ctx.fillStyle = '#1e1b4b'; ctx.font = 'bold 44px monospace';
    ctx.textAlign = 'center'; ctx.fillText(text.slice(-4), 90, 108);
  };
  img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(text);
}

// تحقق من QR للانضمام التلقائي عند فتح الرابط
(function _autoQRJoin() {
  const code = new URLSearchParams(location.search).get('join');
  if (!code) return;
  unlockAchievement('qr');
  setTimeout(() => {
    show('scr-mode');
    setTimeout(() => {
      chooseMode('guest');
      const inp = $('gcode'); if (inp) inp.value = code.toUpperCase().slice(0, 6);
      toast('تم اكتشاف كود الغرفة: '+code.toUpperCase(), 'success');
    }, 300);
  }, 700);
})();

// ─── مشاركة السؤال كصورة ─────────────────────────────────────
function shareQImage(q, a, catName, catIc) {
  const W = 900, H = 500;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#16103a'); g.addColorStop(1, '#08051a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // border
  ctx.save(); ctx.beginPath();
  const r = 28;
  ctx.moveTo(10+r,10); ctx.lineTo(W-10-r,10); ctx.quadraticCurveTo(W-10,10,W-10,10+r);
  ctx.lineTo(W-10,H-10-r); ctx.quadraticCurveTo(W-10,H-10,W-10-r,H-10);
  ctx.lineTo(10+r,H-10); ctx.quadraticCurveTo(10,H-10,10,H-10-r);
  ctx.lineTo(10,10+r); ctx.quadraticCurveTo(10,10,10+r,10); ctx.closePath();
  ctx.strokeStyle = 'rgba(147,51,234,.65)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  // logo
  ctx.fillStyle = '#a855f7'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText('خَلّد 🎮', W-36, 56);
  // category
  ctx.fillStyle = 'rgba(237,233,254,.55)'; ctx.font = '22px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(catIc+' '+catName, W/2, 105);
  // question
  ctx.fillStyle = '#ede9fe'; ctx.font = 'bold 30px sans-serif';
  _cvWrap(ctx, q, W/2, 185, W-120, 44);
  // divider
  ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60,360); ctx.lineTo(W-60,360); ctx.stroke();
  // answer
  ctx.fillStyle = '#10b981'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('✅ '+a, W/2, 408);
  // footer
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.font = '15px sans-serif';
  ctx.fillText('العب مع خَلّد — منصة ألعاب أبو خالد', W/2, 466);
  cv.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'khallad-question.png'; link.click();
    URL.revokeObjectURL(url);
    unlockAchievement('shared'); trackStat('images_shared');
    toast('تم تحميل صورة السؤال 📸', 'success');
  });
}
function _cvWrap(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' '); let line = '';
  for (let i = 0; i < words.length; i++) {
    const t = line + words[i] + ' ';
    if (ctx.measureText(t).width > maxW && i > 0) {
      ctx.fillText(line.trim(), x, y); line = words[i]+' '; y += lineH;
    } else line = t;
  }
  if (line.trim()) ctx.fillText(line.trim(), x, y);
}

// ─── الثيم الموسمي ───────────────────────────────────────────
(function _seasonalBanner() {
  const m = new Date().getMonth() + 1, d = new Date().getDate();
  let msg = null;
  if (m === 3)                          msg = '🌙 رمضان كريم — كل عام وأنتم بخير';
  if (m === 4 && d <= 8)               msg = '🎉 عيد الفطر المبارك — كل عام وأنتم بخير';
  if (m === 9 && d === 23)             msg = '🇸🇦 اليوم الوطني السعودي 93 — عاشت المملكة';
  if (m === 6 && d >= 15 && d <= 22)   msg = '🐑 عيد الأضحى المبارك — تقبل الله طاعتكم';
  if (m === 1 && d <= 3)               msg = '🎆 سنة هجرية جديدة سعيدة';
  if (!msg) return;
  const el = document.createElement('div');
  el.style.cssText = 'text-align:center;font-weight:800;font-size:14.5px;padding:9px 16px;margin-bottom:14px;'+
    'background:linear-gradient(135deg,rgba(217,70,239,.18),rgba(147,51,234,.12));'+
    'border:1px solid rgba(217,70,239,.32);border-radius:13px;animation:pulse 2.5s infinite';
  el.textContent = msg;
  const stats = $('scr-hub').querySelector('.hub-stats');
  if (stats) stats.insertAdjacentElement('beforebegin', el);
})();

// ─── وضع الذكاء الاصطناعي (المنافس الآلي) ────────────────────
const AI_NAMES = ['ذكاء خَلّد 🤖','الروبوت الذكي 🦾','المنافس الآلي ⚡'];
let _aiTimer = null;
function enableAIForGame() {
  if (!MG) return;
  aiEnabled = true;
  MG.teams[1] = { name: AI_NAMES[Math.floor(Math.random()*AI_NAMES.length)], score: 0 };
  toast('🤖 الذكاء الاصطناعي جاهز للمنافسة!', 'info');
}
function aiAutoAnswer(pts, onAIWins) {
  if (!aiEnabled) return;
  clearTimeout(_aiTimer);
  const pts2diff = { 1:'easy', 2:'medium', 3:'hard', 4:'hard' };
  const diff = pts2diff[pts] || 'medium';
  const [lo, hi] = diff==='easy' ? [3000,9000] : diff==='hard' ? [16000,38000] : [7000,20000];
  const delay = lo + Math.random()*(hi-lo);
  const wins = Math.random() < (diff==='easy'?0.55:diff==='hard'?0.30:0.42);
  if (wins) {
    _aiTimer = setTimeout(() => {
      if (MG && !MG._aiDone) {
        MG._aiDone = true;
        sReveal();
        toast('🤖 '+MG.teams[1].name+' أجاب قبلك!', 'warn', 2500);
        setTimeout(() => mgAward(1, pts), 800);
      }
    }, delay);
  }
}
// ══════════════════════════════════════════════════════════════
// لعبة خمن الصورة — ألغاز بصرية بالإيموجي
// ══════════════════════════════════════════════════════════════
GAMES.guess = {
  init() {
    MG.title = '🖼️ خمن الصورة';
    MG.gCat = null;
    MG.gData = (window.KHALLAD_EXTRA && window.KHALLAD_EXTRA.guess) || [];
    this.render();
  },
  render() {
    const cats = [...new Set(MG.gData.map(q => q.cat))];
    const chipbar = `<div class="chipbar">
      <span class="fchip ${!MG.gCat?'onn':''}" onclick="GAMES.guess.setCat(null)">🎲 الكل</span>
      ${cats.map(c => `<span class="fchip ${MG.gCat===c?'onn':''}" onclick="GAMES.guess.setCat(decodeURIComponent('${encodeURIComponent(c)}'))">${c}</span>`).join('')}
    </div>`;
    mgShell(MG.title,
      chipbar + '<div id="guessArea" class="center" style="padding:30px 16px;color:var(--muted);font-size:16px;font-weight:800">اضغط «جولة جديدة» للبدء 🎲</div>',
      '<button class="btn btn-main" onclick="sClick();GAMES.guess.round()">🎲 جولة جديدة</button>');
    MG.refresh = () => this.render();
  },
  setCat(cat) { sClick(); MG.gCat = cat; this.render(); },
  round() {
    const pool = MG.gCat ? MG.gData.filter(q => q.cat === MG.gCat) : MG.gData;
    if (!pool.length) { toast('لا توجد ألغاز في هذه الفئة', 'warn'); return; }
    MG.gQ = pickNext('guess_' + (MG.gCat || 'all'), pool);
    const q = MG.gQ;
    MG.next = () => this.round();
    $('guessArea').innerHTML =
      `<div style="font-size:clamp(56px,14vw,100px);text-align:center;line-height:1.3;padding:16px 8px;animation:popIn .45s cubic-bezier(.34,1.56,.64,1)">${q.clue}</div>
       <div style="font-size:12px;font-weight:800;color:var(--muted);margin-bottom:14px;letter-spacing:.5px">${q.cat}</div>
       ${mgRing(30, () => GAMES.guess.revealCurrent())}
       <div class="mg-ctrl"><button class="btn btn-cyan btn-sm" onclick="GAMES.guess.revealCurrent()">اعرض الجواب 👀</button></div>
       <div class="ansbox" id="gAns"></div><div id="gJudge"></div>`;
  },
  revealCurrent() {
    const q = MG.gQ; if (!q) return;
    clearInterval(mgTimerInt); sReveal();
    $('gAns').innerHTML = `<div style="font-size:clamp(22px,4.5vw,30px);font-weight:900">${esc(q.answer)}</div>
      <div style="font-size:12.5px;color:rgba(52,211,153,.7);margin-top:6px">💡 ${esc(q.hint)}</div>`;
    $('gAns').style.display = 'block';
    $('gJudge').innerHTML = judge3(2);
  }
};

// ══════════════════════════════════════════════════════════════
// لعبة حروف وألوف — شبكة حروف تنافسية
// ══════════════════════════════════════════════════════════════
GAMES.harf = {
  LETTERS: 'بتثجحخدذرزسشصضطظعغفقكلمنه'.split(''),
  init() {
    MG.title = '⬡ حروف وألوف';
    MG.harfCells = this.LETTERS.map(l => ({ letter: l, owner: null }));
    MG.harfTurn  = 0;
    MG.harfCellIdx = -1;
    this.renderBoard();
  },
  renderBoard() {
    const cells = MG.harfCells.map((c, i) => {
      const bg = c.owner === 0 ? '#0e4f6e' : c.owner === 1 ? '#5b1ca6' : '#1d1145';
      const border = c.owner === 0 ? '2px solid #22d3ee' : c.owner === 1 ? '2px solid #a855f7' : '2px solid rgba(255,255,255,.18)';
      return `<button class="harf-cell" style="background:${bg};border:${border}"
        onclick="GAMES.harf.pickCell(${i})" ${c.owner !== null ? 'disabled' : ''}>${c.letter}</button>`;
    }).join('');
    const turnColor = MG.harfTurn === 0 ? 'var(--cyan)' : 'var(--mag)';
    const turnName  = esc(MG.teams[MG.harfTurn].name);
    mgShell(MG.title,
      `<div class="midtext" style="padding:8px 4px;font-size:16px">دور <b style="color:${turnColor}">${turnName}</b> — اختر حرفاً 👇</div>
       <div class="harf-grid">${cells}</div>
       <div id="harfQArea"></div>`,
      `<div style="display:flex;gap:10px;margin-top:8px">
        <div style="flex:1;text-align:center;padding:10px;border-radius:12px;background:#0e4f6e;font-family:Lalezar;font-size:18px">🟦 ${esc(MG.teams[0].name)} — <span id="harfS0">${MG.teams[0].score}</span></div>
        <div style="flex:1;text-align:center;padding:10px;border-radius:12px;background:#5b1ca6;font-family:Lalezar;font-size:18px">🟪 ${esc(MG.teams[1].name)} — <span id="harfS1">${MG.teams[1].score}</span></div>
      </div>`);
    MG.refresh = () => this.renderBoard();
  },
  pickCell(i) {
    if (MG.harfCells[i].owner !== null) return;
    const letter = MG.harfCells[i].letter;
    MG.harfCellIdx = i;
    sOpen();
    const pool = [];
    for (const cat of Object.values(BANK)) {
      for (const q of cat.qs) {
        const firstChar = (q.a || '').trimStart().charAt(0);
        if (firstChar === letter) pool.push({ ...q, catName: cat.name, catIc: cat.ic });
      }
    }
    if (!pool.length) {
      toast(`لا توجد أسئلة بحرف "${letter}"، اختر حرفاً آخر`, 'warn');
      return;
    }
    const q = pool[Math.floor(Math.random() * pool.length)];
    MG.harfQ = q;
    $('harfQArea').innerHTML =
      `<div style="margin:14px 0;padding:16px;background:rgba(13,6,46,.95);border-radius:16px;border:1px solid rgba(255,255,255,.13)">
        <div style="font-size:12px;font-weight:800;color:var(--muted);margin-bottom:8px">${q.catIc} ${esc(q.catName)} • الجواب يبدأ بـ <b style="color:var(--amber);font-size:22px;font-family:Lalezar">${letter}</b></div>
        <div style="font-size:clamp(16px,3.2vw,22px);font-weight:800;line-height:1.75">${esc(q.q)}</div>
      </div>
      ${mgRing(25, () => GAMES.harf.revealQ())}
      <div class="mg-ctrl"><button class="btn btn-cyan btn-sm" onclick="GAMES.harf.revealQ()">الجواب 👀</button></div>
      <div class="ansbox" id="harfAns"></div><div id="harfJudge"></div>`;
  },
  revealQ() {
    clearInterval(mgTimerInt); sReveal();
    const q = MG.harfQ; if (!q) return;
    $('harfAns').textContent = '✅ ' + q.a;
    $('harfAns').style.display = 'block';
    $('harfJudge').innerHTML =
      `<div class="judge3" style="margin-top:14px">
        <button class="jj-a" onclick="GAMES.harf.awardCell(0)">🟦 ${esc(MG.teams[0].name)} ✓</button>
        <button class="jj-b" onclick="GAMES.harf.awardCell(1)">🟪 ${esc(MG.teams[1].name)} ✓</button>
        <button class="jj-n" onclick="GAMES.harf.skipCell()">محد جاوب 😅</button>
      </div>`;
  },
  awardCell(team) {
    const i = MG.harfCellIdx; if (i < 0) return;
    MG.harfCells[i].owner = team;
    MG.teams[team].score += 2; sAward();
    const s = document.getElementById('harfS' + team);
    if (s) s.textContent = MG.teams[team].score;
    MG.harfTurn = 1 - MG.harfTurn;
    if (MG.harfCells.every(c => c.owner !== null)) { mgEnd(); return; }
    if (this.checkWin() !== null) { mgEnd(); return; }
    setTimeout(() => this.renderBoard(), 500);
  },
  skipCell() { MG.harfTurn = 1 - MG.harfTurn; setTimeout(() => this.renderBoard(), 400); },
  checkWin() {
    const g = MG.harfCells;
    for (let team = 0; team < 2; team++) {
      for (let r = 0; r < 5; r++) if ([0,1,2,3,4].every(c => g[r*5+c] && g[r*5+c].owner === team)) return team;
      for (let c = 0; c < 5; c++) if ([0,1,2,3,4].every(r => g[r*5+c] && g[r*5+c].owner === team)) return team;
    }
    return null;
  }
};

// ══════════════════════════════════════════════════════════════
// لعبة الميدان — غزو فئات الميدان
// ══════════════════════════════════════════════════════════════
GAMES.midan = {
  CATS: null,
  init() {
    MG.title = '🏟️ الميدان';
    const allCats = Object.keys(BANK);
    const picked  = allCats.slice().sort(() => Math.random() - .5).slice(0, 12);
    MG.midanCells = picked.map(key => ({ key, owner: null }));
    MG.midanTurn  = 0;
    MG.midanCellIdx = -1;
    this.renderBoard();
  },
  renderBoard() {
    const cells = MG.midanCells.map((cell, i) => {
      const cat = BANK[cell.key] || {};
      const bg  = cell.owner === 0 ? 'rgba(14,79,110,.92)' : cell.owner === 1 ? 'rgba(91,28,166,.92)' : 'rgba(21,11,51,.82)';
      const bdr = cell.owner === 0 ? 'var(--cyan)' : cell.owner === 1 ? 'var(--mag)' : 'rgba(255,255,255,.12)';
      const tick = cell.owner === 0 ? '🟦' : cell.owner === 1 ? '🟪' : '';
      return `<div class="midan-cell ${cell.owner !== null ? 'claimed' : ''}"
        style="background:${bg};border:1.5px solid ${bdr}"
        onclick="GAMES.midan.pickCell(${i})">
        <div style="font-size:26px">${tick || cat.ic || '❓'}</div>
        <div style="font-size:11.5px;font-weight:800;margin-top:4px;color:${cell.owner !== null ? 'rgba(255,255,255,.9)' : 'var(--muted)'}">${esc(cat.name || '')}</div>
      </div>`;
    }).join('');
    const turnColor = MG.midanTurn === 0 ? 'var(--cyan)' : 'var(--mag)';
    mgShell(MG.title,
      `<div class="midtext" style="padding:6px 4px;font-size:15px">دور <b style="color:${turnColor}">${esc(MG.teams[MG.midanTurn].name)}</b> — اختر فئة 👇</div>
       <div class="midan-grid">${cells}</div>
       <div id="midanQArea"></div>`, '');
    MG.refresh = () => this.renderBoard();
  },
  pickCell(i) {
    if (MG.midanCells[i].owner !== null) { toast('هذه المنطقة محجوزة بالفعل، اختر غيرها', 'warn'); return; }
    const key = MG.midanCells[i].key;
    const cat = BANK[key];
    if (!cat || !cat.qs.length) return;
    MG.midanCellIdx = i;
    const q = cat.qs[Math.floor(Math.random() * cat.qs.length)];
    MG.midanQ = q;
    sOpen();
    $('midanQArea').innerHTML =
      `<div style="margin:14px 0;padding:16px;background:rgba(13,6,46,.95);border-radius:16px;border:1px solid rgba(255,255,255,.13)">
        <div style="font-size:12px;font-weight:800;color:var(--muted);margin-bottom:8px">${cat.ic} ${esc(cat.name)} • <span style="color:var(--amber)">${q.p} نقطة</span></div>
        <div style="font-size:clamp(16px,3.2vw,22px);font-weight:800;line-height:1.75">${esc(q.q)}</div>
      </div>
      ${mgRing(30, () => GAMES.midan.revealQ())}
      <div class="mg-ctrl"><button class="btn btn-cyan btn-sm" onclick="GAMES.midan.revealQ()">الجواب 👀</button></div>
      <div class="ansbox" id="midanAns"></div><div id="midanJudge"></div>`;
  },
  revealQ() {
    clearInterval(mgTimerInt); sReveal();
    const q = MG.midanQ; if (!q) return;
    $('midanAns').textContent = '✅ ' + q.a;
    $('midanAns').style.display = 'block';
    $('midanJudge').innerHTML =
      `<div class="judge3" style="margin-top:14px">
        <button class="jj-a" onclick="GAMES.midan.claimCell(0)">🟦 ${esc(MG.teams[0].name)} ✓</button>
        <button class="jj-b" onclick="GAMES.midan.claimCell(1)">🟪 ${esc(MG.teams[1].name)} ✓</button>
        <button class="jj-n" onclick="GAMES.midan.skipTurn()">محد أجاب 😅</button>
      </div>`;
  },
  claimCell(team) {
    const i = MG.midanCellIdx; if (i < 0) return;
    MG.midanCells[i].owner = team;
    MG.teams[team].score += MG.midanQ.p; sAward();
    const el = $('mgs' + team);
    if (el) { el.textContent = MG.teams[team].score; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    MG.midanTurn = 1 - MG.midanTurn;
    if (MG.midanCells.every(c => c.owner !== null)) { mgEnd(); return; }
    setTimeout(() => this.renderBoard(), 600);
  },
  skipTurn() { MG.midanTurn = 1 - MG.midanTurn; setTimeout(() => this.renderBoard(), 400); }
};

// ══════════════════════════════════════════════════════════════
// لعبة بنك الأسئلة — اختر السؤال واربح أو تُسرق!
// ══════════════════════════════════════════════════════════════
GAMES.bankq = {
  init() {
    MG.title   = '💰 بنك الأسئلة';
    MG.bankDone = {};
    MG.bankQ    = null;
    MG.bankMeta = null;
    MG.next     = () => this.render();
    this.render();
  },
  render() {
    const cats   = Object.entries(BANK).slice(0, 8);
    const levels = [200, 400, 600];
    const rows = cats.map(([key, cat]) => {
      const btns = levels.map(lvl => {
        const has  = cat.qs.some(q => q.p === lvl);
        const done = MG.bankDone[key + '_' + lvl];
        return `<button class="bank-cell p${lvl} ${done ? 'done' : ''}"
          onclick="GAMES.bankq.pickQ('${key}',${lvl})" ${(!has || done) ? 'disabled' : ''}>
          ${done ? '✓' : lvl + ' 💰'}</button>`;
      }).join('');
      return `<div class="bank-row">
        <div class="bcat"><span style="font-size:20px">${cat.ic}</span><span style="font-size:12px;font-weight:800">${esc(cat.name)}</span></div>
        <div class="bank-pts">${btns}</div>
      </div>`;
    }).join('');
    mgShell(MG.title,
      `<div style="font-size:12.5px;color:var(--muted);font-weight:800;padding:4px 2px;margin-bottom:8px">اختر فئة ونقاط — إذا أخطأت، الفريق الثاني يسرق! 🔥</div>
       <div class="bank-board">${rows}</div>
       <div id="bankQArea"></div>`, '');
    MG.refresh = () => this.render();
  },
  pickQ(key, lvl) {
    const cat  = BANK[key]; if (!cat) return;
    const pool = cat.qs.filter(q => q.p === lvl);
    if (!pool.length) { toast('لا أسئلة في هذا المستوى', 'warn'); return; }
    const q = pool[Math.floor(Math.random() * pool.length)];
    MG.bankQ    = q;
    MG.bankMeta = { key, lvl, catName: cat.name, catIc: cat.ic };
    sOpen();
    $('bankQArea').innerHTML =
      `<div style="margin:14px 0;padding:16px;background:rgba(13,6,46,.95);border-radius:16px;border:1px solid rgba(255,255,255,.13)">
        <div style="font-size:12px;font-weight:800;color:var(--amber);margin-bottom:8px">${cat.ic} ${esc(cat.name)} — <b>${lvl} 💰</b></div>
        <div style="font-size:clamp(16px,3.2vw,23px);font-weight:800;line-height:1.75">${esc(q.q)}</div>
      </div>
      ${mgRing(40, () => GAMES.bankq.revealQ())}
      <div class="mg-ctrl"><button class="btn btn-cyan btn-sm" onclick="GAMES.bankq.revealQ()">الجواب 👀</button></div>
      <div class="ansbox" id="bankAns"></div><div id="bankJudge"></div>`;
  },
  revealQ() {
    clearInterval(mgTimerInt); sReveal();
    const q = MG.bankQ; if (!q) return;
    $('bankAns').textContent = '✅ ' + q.a;
    $('bankAns').style.display = 'block';
    const { key, lvl } = MG.bankMeta;
    $('bankJudge').innerHTML =
      `<div class="judge3" style="margin-top:14px">
        <button class="jj-a" onclick="GAMES.bankq.award(0)">🟦 ${esc(MG.teams[0].name)} ✓</button>
        <button class="jj-b" onclick="GAMES.bankq.award(1)">🟪 ${esc(MG.teams[1].name)} ✓</button>
        <button class="jj-n" onclick="GAMES.bankq.award(null)">محد جاوب 😅</button>
      </div>`;
    MG.bankDone[key + '_' + lvl] = true;
  },
  award(team) {
    const pts = MG.bankMeta ? MG.bankMeta.lvl / 100 : 1;
    if (team !== null) {
      MG.teams[team].score += pts; sAward();
      const el = $('mgs' + team);
      if (el) { el.textContent = MG.teams[team].score; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    } else sNone();
    clearInterval(mgTimerInt);
    if (MG.next) MG.next();
  }
};

// إضافة زر AI في المنيجيم
const _origMgShell = mgShell;
mgShell = function(title, body, ctrl) {
  _origMgShell(title, body, ctrl);
  const topEl = $('mgRoot')?.querySelector('.mg-top');
  if (topEl && !topEl.querySelector('#aiToggleBtn')) {
    const btn = document.createElement('button');
    btn.id = 'aiToggleBtn';
    btn.className = 'btn btn-ghost btn-sm';
    btn.style.cssText = 'margin-inline-start:8px';
    btn.textContent = aiEnabled ? '🤖 ذكاء: شغّال' : '🤖 ضد الذكاء';
    btn.onclick = () => {
      aiEnabled = !aiEnabled;
      btn.textContent = aiEnabled ? '🤖 ذكاء: شغّال' : '🤖 ضد الذكاء';
      btn.style.background = aiEnabled ? 'linear-gradient(112deg,#1e40af,#3b82f6)' : '';
      if (aiEnabled && MG) {
        MG.teams[1] = { name: AI_NAMES[Math.floor(Math.random()*AI_NAMES.length)], score: 0 };
        const s = document.getElementById('mgs1'), n = document.getElementById('mgn1');
        if (n) n.textContent = MG.teams[1].name;
        if (s) s.textContent = '0';
        toast('🤖 الذكاء الاصطناعي انضم كمنافس!', 'info');
      } else { aiEnabled = false; toast('👥 وضع اللاعبين العاديين', 'info'); }
    };
    topEl.appendChild(btn);
  }
  if (MG) MG._aiDone = false;
};
