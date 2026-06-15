/**
 * خَلّد — السيرفر (Cloudflare Worker + Durable Objects + D1)
 *  - غرف سين جيم أونلاين عبر WebSockets (Durable Object: GameRoom)
 *  - قاعدة بيانات D1: الأسئلة المضافة، المتصدرون، المستخدمون
 *  - تسجيل دخول قوقل (التحقق من رمز JWT عبر tokeninfo)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...CORS_HEADERS,
  },
});

/* ============ Rate Limiter بسيط ============ */
const rateLimitMap = new Map();
function checkRateLimit(ip, limit = 30, windowMs = 60000) {
  const now = Date.now();
  const key = ip;
  const record = rateLimitMap.get(key) || { count: 0, start: now };
  if (now - record.start > windowMs) {
    record.count = 1; record.start = now;
  } else {
    record.count++;
  }
  rateLimitMap.set(key, record);
  if (rateLimitMap.size > 10000) {
    for (const [k, v] of rateLimitMap) {
      if (now - v.start > windowMs * 2) rateLimitMap.delete(k);
    }
  }
  return record.count <= limit;
}

/* ============ Durable Object: غرفة اللعب ============ */
export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.sessions = new Map();
    this.game = null;
  }

  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket')
      return new Response('Expected WebSocket', { status: 426 });
    const url = new URL(req.url);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    await this.handle(server, url);
    return new Response(null, { status: 101, webSocket: client });
  }

  async handle(ws, url) {
    ws.accept();
    const name = (url.searchParams.get('name') || 'لاعب').slice(0, 24);
    const wantHost = url.searchParams.get('role') === 'host';
    const roles = [...this.sessions.values()].map(s => s.role);
    let role;
    if (wantHost) {
      if (roles.includes('host')) {
        ws.send(JSON.stringify({ t: 'err', m: 'الغرفة لها مضيف بالفعل' }));
        ws.close();
        return;
      }
      role = 'host';
    } else {
      role = roles.includes('guest') ? 'watch' : 'guest';
    }
    this.sessions.set(ws, { role, name });
    if (!this.game) this.game = (await this.state.storage.get('game')) || null;
    ws.send(JSON.stringify({ t: 'welcome', role, players: this.players(), game: this.game }));
    this.broadcast({ t: 'players', players: this.players() }, ws);

    ws.addEventListener('message', async ev => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      const me = this.sessions.get(ws);
      if (!me) return;

      if (m.t === 'state' && me.role === 'host') {
        this.game = m.game;
        await this.state.storage.put('game', this.game);
        for (const [sock, s] of this.sessions) {
          if (s.role !== 'host') this.safe(sock, { t: 'state', game: this.game });
        }
      }
      if (m.t === 'act' && me.role !== 'host') {
        const allowedActions = ['pick', 'life'];
        if (!m.action || !allowedActions.includes(m.action.a)) return;
        for (const [sock, s] of this.sessions) {
          if (s.role === 'host') this.safe(sock, { t: 'act', action: m.action, from: me.role });
        }
      }
    });

    const bye = () => {
      const s = this.sessions.get(ws);
      this.sessions.delete(ws);
      if (s?.role === 'host') this.broadcast({ t: 'hostLeft' });
      if (s?.role === 'guest') this.broadcast({ t: 'guestLeft' });
      this.broadcast({ t: 'players', players: this.players() });
    };
    ws.addEventListener('close', bye);
    ws.addEventListener('error', bye);
  }

  players() { return [...this.sessions.values()].map(s => ({ role: s.role, name: s.name })); }
  safe(ws, o) { try { ws.send(JSON.stringify(o)); } catch { } }
  broadcast(o, except = null) { for (const [ws] of this.sessions) if (ws !== except) this.safe(ws, o); }
}

/* ============ تهيئة قاعدة البيانات (D1) ============ */
async function ensureSchema(db) {
  if (!db) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS questions(
      id INTEGER PRIMARY KEY AUTOINCREMENT, cat TEXT, p INTEGER, q TEXT, a TEXT,
      by_user TEXT, created INTEGER, approved INTEGER DEFAULT 1)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS scores(
      id INTEGER PRIMARY KEY AUTOINCREMENT, game TEXT, name TEXT, score INTEGER,
      by_user TEXT, created INTEGER)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS users(
      sub TEXT PRIMARY KEY, name TEXT, email TEXT, picture TEXT, created INTEGER)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_questions_cat ON questions(cat, approved)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_scores_game ON scores(game, score DESC)`),
  ]);
}

/* ============ التحقق من رمز قوقل ============ */
async function verifyGoogle(credential) {
  if (!credential || typeof credential !== 'string' || credential.length > 4096) return null;
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
    if (!r.ok) return null;
    const p = await r.json();
    if (!p.sub) return null;
    return { sub: p.sub, name: p.name || p.email || 'لاعب', email: p.email || '', picture: p.picture || '' };
  } catch {
    return null;
  }
}

/* ============ Worker الرئيسي ============ */
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    const db = env.DB;

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // غرف اللعب
    const room = path.match(/^\/api\/room\/([A-Z0-9]{4,8})\/ws$/);
    if (room) {
      const code = room[1];
      const id = env.ROOMS.idFromName(code);
      return env.ROOMS.get(id).fetch(req);
    }

    // ===== واجهات قاعدة البيانات =====
    if (path.startsWith('/api/')) {
      // Rate limiting
      const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
      if (!checkRateLimit(ip)) {
        return json({ error: 'طلبات كثيرة — حاول بعد دقيقة' }, 429);
      }

      try {
        if (db) await ensureSchema(db);

        // جلب الأسئلة المعتمدة
        if (path === '/api/questions' && req.method === 'GET') {
          if (!db) return new Response('[]', {
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', ...CORS_HEADERS }
          });
          const { results } = await db.prepare(
            'SELECT cat,p,q,a FROM questions WHERE approved=1 ORDER BY id DESC LIMIT 5000'
          ).all();
          return new Response(JSON.stringify(results || []), {
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', ...CORS_HEADERS }
          });
        }

        // إضافة سؤال
        if (path === '/api/questions' && req.method === 'POST') {
          const b = await req.json().catch(() => null);
          if (!b || !b.cat || !b.q || !b.a) return json({ ok: false, error: 'بيانات ناقصة' }, 400);
          const q = String(b.q).trim().slice(0, 400);
          const a = String(b.a).trim().slice(0, 200);
          if (q.length < 5 || a.length < 1) return json({ ok: false, error: 'السؤال أو الجواب قصير جداً' }, 400);
          if (db) await db.prepare(
            'INSERT INTO questions(cat,p,q,a,by_user,created,approved) VALUES(?,?,?,?,?,?,1)'
          ).bind(String(b.cat).slice(0, 40), +b.p || 400, q, a, b.by ? String(b.by).slice(0, 40) : null, Date.now()).run();
          return json({ ok: true });
        }

        // المتصدرون
        if (path === '/api/leaderboard' && req.method === 'GET') {
          if (!db) return json([]);
          const { results } = await db.prepare(
            'SELECT game,name,MAX(score) as score FROM scores GROUP BY game,name ORDER BY score DESC LIMIT 20'
          ).all();
          return json(results || []);
        }

        // حفظ نتيجة
        if (path === '/api/score' && req.method === 'POST') {
          const b = await req.json().catch(() => null);
          if (!b || !b.name) return json({ ok: false, error: 'بيانات ناقصة' }, 400);
          const score = Math.min(Math.max(0, +b.score || 0), 999999);
          if (db) await db.prepare(
            'INSERT INTO scores(game,name,score,by_user,created) VALUES(?,?,?,?,?)'
          ).bind(
            String(b.game || 'لعبة').slice(0, 40),
            String(b.name).slice(0, 40),
            score,
            b.by ? String(b.by).slice(0, 40) : null,
            Date.now()
          ).run();
          return json({ ok: true });
        }

        // تسجيل دخول قوقل
        if (path === '/api/auth/google' && req.method === 'POST') {
          const b = await req.json().catch(() => null);
          const u = await verifyGoogle(b?.credential || '');
          if (!u) return json({ error: 'رمز غير صالح' }, 401);
          if (db) await db.prepare(
            'INSERT OR REPLACE INTO users(sub,name,email,picture,created) VALUES(?,?,?,?,?)'
          ).bind(u.sub, u.name, u.email, u.picture, Date.now()).run();
          return json(u);
        }

      } catch (e) {
        console.error('API Error:', e);
        return json({ error: 'خطأ داخلي' }, 500);
      }
      return json({ error: 'not found' }, 404);
    }

    // الملفات الثابتة — مع Security Headers
    const res = await env.ASSETS.fetch(req);
    const newHeaders = new Headers(res.headers);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      newHeaders.set(k, v);
    }
    // تخزين مؤقت للملفات الثابتة
    if (path.endsWith('.js') || path.endsWith('.css')) {
      newHeaders.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    }
    return new Response(res.body, { status: res.status, headers: newHeaders });
  },
};
