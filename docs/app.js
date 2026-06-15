/* ============================================================
 * خَلّد — app.js  v2.1
 * منصة ألعاب أبو خالد | Cloudflare Workers + Durable Objects
 * ============================================================ */
'use strict';

// ─── إعداد Google OAuth ───────────────────────────────────────
const GOOGLE_CLIENT_ID = ""; // ضع Client ID هنا بعد إنشائه من Google Cloud Console

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
  { id:'fast', t:'مين أسرع واحد؟',     ic:'🏁', e1:'🏃', e2:'⏱️', d:'أوامر لحظية: أول واحد يسوّيها ياخذ النقطة!',            g:'linear-gradient(150deg,#a16207,#422006)', n:()=>GM.fast.length+' أمر', go:()=>mgStart('fast') },
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
    ? `<img class="avatar" src="${esc(USER.picture||'')}" onerror="this.style.display='none'">
       <span class="uname">${esc(USER.name)}</span>
       <button class="btn btn-ghost btn-sm" onclick="logout()">خروج</button>`
    : `<button class="btn btn-ghost btn-sm" id="gBtn" onclick="googleLogin()">🔐 دخول بقوقل</button>`;
}
function logout() { USER = null; store.set('user', null); renderAuth(); }
function googleLogin() {
  if (!GOOGLE_CLIENT_ID) {
    modal(`<div class="sec-title">🔐 تسجيل الدخول بقوقل</div>
      <div style="font-weight:700;line-height:1.9;color:var(--muted)">لتفعيل الدخول بقوقل بعد النشر:<br>
      1) أنشئ <b style="color:var(--ink)">OAuth Client ID</b> من Google Cloud Console<br>
      2) أضف نطاق موقعك في Authorized origins<br>
      3) ضع المعرف في بداية ملف <b>app.js</b> بالمتغير GOOGLE_CLIENT_ID<br><br>
      الخطوات بالتفصيل داخل README_AR.md 📄</div>
      <div class="center" style="margin-top:14px"><button class="btn btn-main btn-sm" onclick="closeModal()">تمام</button></div>`);
    return;
  }
  if (!window.google?.accounts) {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = googleLogin;
    document.head.appendChild(s);
    return;
  }
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: async res => {
      try {
        const r = await fetch('/api/auth/google', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: res.credential }),
        });
        const u = await r.json();
        if (u?.name) { USER = u; store.set('user', u); renderAuth(); sAward(); toast('مرحباً ' + u.name + ' 👋', 'success'); }
      } catch { toast('تعذر التحقق — تأكد أن الموقع منشور على كلاودفلير', 'err'); }
    },
  });
  google.accounts.id.prompt();
}
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
      <span style="font-size:18px" title="${esc(r.c.name)}">${r.c.ic}</span></div>`
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
  show('scr-end'); sWin(); confetti();
}

// ─── مؤقت السؤال ─────────────────────────────────────────────
let lastTick = -1;
setInterval(() => {
  const g = game;
  if (!g || !g.act || g.act.revealed || !$('scr-q').classList.contains('on')) return;
  const limit = TIME + (g.act.extra || 0);
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
    navigator.serviceWorker.register('/sw.js')
      .then(r => console.log('SW registered:', r.scope))
      .catch(e => console.log('SW error:', e));
  });
}
