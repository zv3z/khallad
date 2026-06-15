/**
 * خَلّد — Worker v2.1
 * Cloudflare Worker + Durable Objects + D1
 */
'use strict';

// ─── Headers ─────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Key',
};
const SEC = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS, ...extra },
  });

// ─── Rate Limiter ─────────────────────────────────────────────
const rlMap = new Map();
function rateLimit(ip, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  let rec = rlMap.get(ip) || { n: 0, t: now };
  if (now - rec.t > windowMs) rec = { n: 0, t: now };
  rec.n++;
  rlMap.set(ip, rec);
  if (rlMap.size > 5000) {
    for (const [k, v] of rlMap) if (now - v.t > windowMs * 2) rlMap.delete(k);
  }
  return rec.n <= limit;
}

// ─── Durable Object: غرفة اللعب ──────────────────────────────
export class GameRoom {
  constructor(state, env) {
    this.state    = state;
    this.sessions = new Map();
    this.game     = null;
    this.env      = env;
  }

  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket')
      return new Response('Expected WebSocket', { status: 426 });
    const url  = new URL(req.url);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.handle(server, url);
    return new Response(null, { status: 101, webSocket: client });
  }

  async handle(ws, url) {
    ws.accept();
    const name     = (url.searchParams.get('name') || 'لاعب').slice(0, 24);
    const wantHost = url.searchParams.get('role') === 'host';
    const roles    = [...this.sessions.values()].map(s => s.role);
    let role;

    if (wantHost) {
      if (roles.includes('host')) {
        ws.send(JSON.stringify({ t: 'err', m: 'الغرفة لها مضيف بالفعل' }));
        ws.close(); return;
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
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      const me = this.sessions.get(ws); if (!me) return;

      if (m.t === 'state' && me.role === 'host') {
        this.game = m.game;
        await this.state.storage.put('game', this.game);
        for (const [s, ses] of this.sessions)
          if (ses.role !== 'host') this.safe(s, { t: 'state', game: this.game });
      }
      if (m.t === 'act' && me.role !== 'host') {
        const allowed = ['pick', 'life'];
        if (!m.action || !allowed.includes(m.action.a)) return;
        for (const [s, ses] of this.sessions)
          if (ses.role === 'host') this.safe(s, { t: 'act', action: m.action, from: me.role });
      }
    });

    // تنظيف الغرفة بعد 6 ساعات من عدم النشاط
    await this.state.storage.setAlarm(Date.now() + 6 * 60 * 60 * 1000);

    const bye = () => {
      const s = this.sessions.get(ws); this.sessions.delete(ws);
      if (s?.role === 'host')  this.broadcast({ t: 'hostLeft' });
      if (s?.role === 'guest') this.broadcast({ t: 'guestLeft' });
      this.broadcast({ t: 'players', players: this.players() });
    };
    ws.addEventListener('close', bye);
    ws.addEventListener('error', bye);
  }

  async alarm() {
    // تنظيف الغرفة بعد انتهاء المهلة
    await this.state.storage.deleteAll();
  }

  players() { return [...this.sessions.values()].map(s => ({ role: s.role, name: s.name })); }
  safe(ws, o) { try { ws.send(JSON.stringify(o)); } catch {} }
  broadcast(o, except = null) {
    for (const [ws] of this.sessions) if (ws !== except) this.safe(ws, o);
  }
}

// ─── Schema D1 ───────────────────────────────────────────────
async function ensureSchema(db) {
  if (!db) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS questions(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cat TEXT NOT NULL, p INTEGER NOT NULL DEFAULT 400,
      q TEXT NOT NULL, a TEXT NOT NULL,
      by_user TEXT, created INTEGER NOT NULL,
      approved INTEGER NOT NULL DEFAULT 0)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS scores(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game TEXT NOT NULL, name TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      by_user TEXT, created INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS users(
      sub TEXT PRIMARY KEY, name TEXT, email TEXT,
      picture TEXT, created INTEGER)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_q_cat     ON questions(cat, approved)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_q_created ON questions(created DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_s_game    ON scores(game, score DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_s_created ON scores(created DESC)`),
  ]);
}

// ─── Google Auth ─────────────────────────────────────────────
async function verifyGoogle(credential) {
  if (!credential || typeof credential !== 'string' || credential.length > 4096) return null;
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
    if (!r.ok) return null;
    const p = await r.json();
    if (!p.sub) return null;
    return { sub: p.sub, name: p.name || p.email || 'لاعب', email: p.email || '', picture: p.picture || '' };
  } catch { return null; }
}

// ─── Admin Auth ───────────────────────────────────────────────
function isAdmin(req, env) {
  const key = req.headers.get('X-Admin-Key') || new URL(req.url).searchParams.get('key');
  return key && env.ADMIN_KEY && key === env.ADMIN_KEY;
}

// ─── Helpers ─────────────────────────────────────────────────
const sanitize = (s, max = 400) => String(s ?? '').trim().slice(0, max);

// ─── Worker ──────────────────────────────────────────────────
export default {
  async fetch(req, env) {
    const url  = new URL(req.url);
    const path = url.pathname;

    // OPTIONS preflight
    if (req.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: CORS });

    // ── WebSocket rooms ─────────────────────────────────────
    const roomMatch = path.match(/^\/api\/room\/([A-Z0-9]{4,8})\/ws$/);
    if (roomMatch) {
      const id = env.ROOMS.idFromName(roomMatch[1]);
      return env.ROOMS.get(id).fetch(req);
    }

    // ── API ──────────────────────────────────────────────────
    if (path.startsWith('/api/')) {
      const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
      if (!rateLimit(ip)) return json({ error: 'طلبات كثيرة — حاول بعد دقيقة' }, 429);

      const db = env.DB ?? null;
      if (db) await ensureSchema(db).catch(() => {});

      try {
        // ── Public: questions ──────────────────────────────
        if (path === '/api/questions' && req.method === 'GET') {
          if (!db) return new Response('[]', { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public,max-age=300', ...CORS } });
          const { results } = await db.prepare(
            'SELECT cat,p,q,a FROM questions WHERE approved=1 ORDER BY id DESC LIMIT 5000'
          ).all();
          return new Response(JSON.stringify(results || []), {
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public,max-age=300', ...CORS },
          });
        }

        if (path === '/api/questions' && req.method === 'POST') {
          const b = await req.json().catch(() => null);
          if (!b?.cat || !b?.q || !b?.a) return json({ ok: false, error: 'بيانات ناقصة' }, 400);
          const q = sanitize(b.q, 400), a = sanitize(b.a, 200);
          if (q.length < 5) return json({ ok: false, error: 'السؤال قصير جداً' }, 400);
          if (db) await db.prepare(
            'INSERT INTO questions(cat,p,q,a,by_user,created,approved) VALUES(?,?,?,?,?,?,0)'
          ).bind(sanitize(b.cat, 40), +b.p || 400, q, a, sanitize(b.by, 40) || null, Date.now()).run();
          return json({ ok: true });
        }

        // ── Public: leaderboard ───────────────────────────
        if (path === '/api/leaderboard' && req.method === 'GET') {
          if (!db) return json([]);
          const limit = Math.min(+(url.searchParams.get('limit') || 20), 100);
          const { results } = await db.prepare(
            `SELECT game, name, MAX(score) AS score, COUNT(*) AS games
             FROM scores GROUP BY game, name ORDER BY score DESC LIMIT ?`
          ).bind(limit).all();
          return json(results || []);
        }

        // ── Public: save score ────────────────────────────
        if (path === '/api/score' && req.method === 'POST') {
          const b = await req.json().catch(() => null);
          if (!b?.name) return json({ ok: false, error: 'بيانات ناقصة' }, 400);
          const score = Math.min(Math.max(0, +b.score || 0), 999_999);
          if (db) await db.prepare(
            'INSERT INTO scores(game,name,score,by_user,created) VALUES(?,?,?,?,?)'
          ).bind(sanitize(b.game || 'لعبة', 40), sanitize(b.name, 40), score, sanitize(b.by, 40) || null, Date.now()).run();
          return json({ ok: true });
        }

        // ── Public: Google auth ───────────────────────────
        if (path === '/api/auth/google' && req.method === 'POST') {
          const b = await req.json().catch(() => null);
          const u = await verifyGoogle(b?.credential || '');
          if (!u) return json({ error: 'رمز غير صالح' }, 401);
          if (db) await db.prepare(
            'INSERT OR REPLACE INTO users(sub,name,email,picture,created) VALUES(?,?,?,?,?)'
          ).bind(u.sub, u.name, u.email, u.picture, Date.now()).run();
          return json(u);
        }

        // ── Public: stats ─────────────────────────────────
        if (path === '/api/stats' && req.method === 'GET') {
          if (!db) return json({ questions: 0, scores: 0, users: 0 });
          const [q, s, u] = await Promise.all([
            db.prepare('SELECT COUNT(*) AS n FROM questions WHERE approved=1').first(),
            db.prepare('SELECT COUNT(*) AS n FROM scores').first(),
            db.prepare('SELECT COUNT(*) AS n FROM users').first(),
          ]);
          return json({ questions: q?.n || 0, scores: s?.n || 0, users: u?.n || 0 });
        }

        // ══ Admin routes ══════════════════════════════════
        if (path.startsWith('/api/admin/')) {
          if (!isAdmin(req, env)) return json({ error: 'غير مصرح' }, 401);

          // إحصائيات
          if (path === '/api/admin/stats') {
            if (!db) return json({});
            const [q, qa, s, u] = await Promise.all([
              db.prepare('SELECT COUNT(*) AS n FROM questions WHERE approved=1').first(),
              db.prepare('SELECT COUNT(*) AS n FROM questions WHERE approved=0').first(),
              db.prepare('SELECT COUNT(*) AS n FROM scores').first(),
              db.prepare('SELECT COUNT(*) AS n FROM users').first(),
            ]);
            return json({ approved: q?.n||0, pending: qa?.n||0, scores: s?.n||0, users: u?.n||0 });
          }

          // قائمة الأسئلة المعلّقة
          if (path === '/api/admin/questions' && req.method === 'GET') {
            if (!db) return json([]);
            const status  = url.searchParams.get('approved') ?? '0';
            const page    = Math.max(0, +(url.searchParams.get('page') || 0));
            const { results } = await db.prepare(
              'SELECT id,cat,p,q,a,by_user,created FROM questions WHERE approved=? ORDER BY created DESC LIMIT 50 OFFSET ?'
            ).bind(+status, page * 50).all();
            return json(results || []);
          }

          // اعتماد سؤال
          if (path.match(/^\/api\/admin\/questions\/\d+\/approve$/) && req.method === 'POST') {
            const id = +path.split('/')[4];
            if (db) await db.prepare('UPDATE questions SET approved=1 WHERE id=?').bind(id).run();
            return json({ ok: true });
          }

          // رفض / حذف سؤال
          if (path.match(/^\/api\/admin\/questions\/\d+$/) && req.method === 'DELETE') {
            const id = +path.split('/')[4];
            if (db) await db.prepare('DELETE FROM questions WHERE id=?').bind(id).run();
            return json({ ok: true });
          }

          // أحدث النتائج
          if (path === '/api/admin/scores' && req.method === 'GET') {
            if (!db) return json([]);
            const { results } = await db.prepare(
              'SELECT * FROM scores ORDER BY created DESC LIMIT 100'
            ).all();
            return json(results || []);
          }

          // حذف نتيجة
          if (path.match(/^\/api\/admin\/scores\/\d+$/) && req.method === 'DELETE') {
            const id = +path.split('/')[4];
            if (db) await db.prepare('DELETE FROM scores WHERE id=?').bind(id).run();
            return json({ ok: true });
          }

          // قائمة المستخدمين
          if (path === '/api/admin/users' && req.method === 'GET') {
            if (!db) return json([]);
            const { results } = await db.prepare(
              'SELECT sub,name,email,created FROM users ORDER BY created DESC LIMIT 200'
            ).all();
            return json(results || []);
          }

          return json({ error: 'not found' }, 404);
        }

      } catch (e) {
        console.error('[Worker]', e);
        return json({ error: 'خطأ داخلي في السيرفر' }, 500);
      }

      return json({ error: 'not found' }, 404);
    }

    // ── Static files ─────────────────────────────────────────
    const res        = await env.ASSETS.fetch(req);
    const newHeaders = new Headers(res.headers);
    Object.entries(SEC).forEach(([k, v]) => newHeaders.set(k, v));
    if (/\.(js|css|json|woff2?)$/.test(path))
      newHeaders.set('Cache-Control', 'public,max-age=86400,stale-while-revalidate=604800');
    return new Response(res.body, { status: res.status, headers: newHeaders });
  },
};
