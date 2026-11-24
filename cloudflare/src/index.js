// KSA site on Cloudflare: static pages from ../ksa-awards, lucky-draw entries in D1.
//   GET  /api/health                 -> {ok:true}  (the page uses this to know it can save here)
//   GET  /api/draw/me?token=…        -> the entrant's own entry
//   POST /api/draw                   -> create, or update when a known token is sent
//   GET  /api/draw/list              -> all entries (Authorization: Bearer <ADMIN_KEY>)
const FIELDS = { company: 60, name: 30, title: 30, phone: 20, address: 200 };
const PHONE = /^0\d{1,2}-?\d{3,4}-?\d{4}$/;
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const row = (r) => r && {
  company: r.company, name: r.name, title: r.title, phone: r.phone, address: r.address,
  at: r.created_at, updated: r.updated_at || undefined,
};

function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function api(request, env, url) {
  const p = url.pathname;

  if (p === "/api/health") return json({ ok: true });

  if (p === "/api/draw/me" && request.method === "GET") {
    const t = url.searchParams.get("token") || "";
    if (!TOKEN.test(t)) return json({ entry: null });
    const r = await env.DB.prepare("SELECT * FROM entries WHERE token = ?").bind(t).first();
    return json({ entry: row(r) });
  }

  if (p === "/api/draw" && request.method === "POST") {
    if (!(request.headers.get("content-type") || "").includes("application/json")) return json({ error: "bad_request" }, 415);
    let body;
    try { body = await request.json(); } catch { return json({ error: "bad_request" }, 400); }
    const v = {};
    for (const [k, max] of Object.entries(FIELDS)) {
      const s = typeof body[k] === "string" ? body[k].trim() : "";
      if (!s || s.length > max) return json({ error: "invalid", field: k }, 400);
      v[k] = s;
    }
    if (!PHONE.test(v.phone)) return json({ error: "invalid", field: "phone" }, 400);
    if (body.agree !== true) return json({ error: "invalid", field: "agree" }, 400);

    const now = new Date().toISOString();
    const t = typeof body.token === "string" && TOKEN.test(body.token) ? body.token : null;
    if (t) {
      const r = await env.DB.prepare(
        "UPDATE entries SET company=?, name=?, title=?, phone=?, address=?, updated_at=? WHERE token=? RETURNING *"
      ).bind(v.company, v.name, v.title, v.phone, v.address, now, t).first();
      if (r) return json({ token: t, entry: row(r) });
    }
    const token = newToken();
    const ip = await sha256((request.headers.get("cf-connecting-ip") || "") + "|ksa");
    const r = await env.DB.prepare(
      "INSERT INTO entries (token, company, name, title, phone, address, agree, created_at, ip_hash) VALUES (?,?,?,?,?,?,1,?,?) RETURNING *"
    ).bind(token, v.company, v.name, v.title, v.phone, v.address, now, ip).first();
    return json({ token, entry: row(r) }, 201);
  }

  if (p === "/api/draw/list" && request.method === "GET") {
    const auth = request.headers.get("authorization") || "";
    const key = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!env.ADMIN_KEY || !timingSafeEqual(key, env.ADMIN_KEY)) return json({ error: "unauthorized" }, 401);
    const { results } = await env.DB.prepare("SELECT * FROM entries ORDER BY created_at ASC").all();
    return json({ entries: results.map(row) });
  }

  return json({ error: "not_found" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try { return await api(request, env, url); }
      catch (e) { console.error(e); return json({ error: "server_error" }, 500); }
    }
    return env.ASSETS.fetch(request);
  },
};
