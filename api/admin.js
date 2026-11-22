// 管理者：GET 查登入狀態、POST 登入／登出、PATCH 改處理狀態、DELETE 刪除名單。
import { writeJson, readJson, listPaths, removePaths } from "../lib/store.js";
import { checkLogin, sessionCookie, clearCookie, currentAdmin, sameOrigin } from "../lib/auth.js";
import { ID_RE, STATUS, stamp } from "../lib/leads.js";
import { hasDb, sql, audit, insertClient } from "../lib/db.js";
import { legacyRows } from "../lib/legacy.js";

// 登入狀態附帶：資料庫是否接上、還有幾筆舊名單沒搬
async function info(email) {
  const out = { email, db: hasDb(), legacy: 0 };
  if (!out.db) return out;
  const done = await sql("select value from meta where key='migrated'");
  if (!done.length) {
    try { out.legacy = (await listPaths("leads/")).length; } catch { out.legacy = 0; }
    if (!out.legacy) await sql("insert into meta (key,value) values ('migrated', $1) on conflict (key) do nothing", [new Date().toISOString()]);
  }
  return out;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const email = currentAdmin(req);
      return email ? res.status(200).json(await info(email)) : res.status(401).json({ error: "unauthorized" });
    }
    if (!sameOrigin(req)) return res.status(403).json({ error: "origin" });
    const b = req.body || {};
    if (req.method === "POST") {
      if (b.action === "logout") { res.setHeader("Set-Cookie", clearCookie()); return res.status(200).json({ ok: true }); }
      if (b.action === "migrate" || b.action === "log_export") {
        const me = currentAdmin(req);
        if (!me) return res.status(401).json({ error: "unauthorized" });
        if (!hasDb()) return res.status(503).json({ error: "no_db" });
        if (b.action === "log_export") { await audit(me, "export", "下載 CSV"); return res.status(200).json({ ok: true }); }
        // 把舊的 Blob 名單搬進資料庫。可重複執行，已搬過的不會重複。舊檔保留不刪，當作備份。
        const rows = await legacyRows();
        let moved = 0;
        for (const r of rows) {
          try { if ((await insertClient(r.id, r, r)).length) moved++; } catch (e) { console.error("migrate skip", r.id, e.message); }
        }
        await sql("insert into meta (key,value) values ('migrated', $1) on conflict (key) do update set value=excluded.value", [new Date().toISOString()]);
        await audit(me, "migrate", `匯入舊名單 ${moved} 筆（共 ${rows.length} 筆）`);
        return res.status(200).json({ moved, total: rows.length });
      }
      if (b.action !== "login") return res.status(400).json({ error: "invalid" });
      const email = checkLogin(b.email, b.password);
      if (!email) { await wait(800); return res.status(401).json({ error: "bad_login" }); }
      res.setHeader("Set-Cookie", sessionCookie(email));
      return res.status(200).json(await info(email));
    }
    if (!currentAdmin(req)) return res.status(401).json({ error: "unauthorized" });
    const id = req.method === "DELETE" ? req.query.id : b.id;
    if (typeof id !== "string" || !ID_RE.test(id)) return res.status(400).json({ error: "invalid" });
    if (req.method === "PATCH") {
      if (!STATUS.includes(b.status)) return res.status(400).json({ error: "invalid" });
      if (!(await readJson(`leads/${id}.json`))) return res.status(404).json({ error: "not_found" });
      await writeJson(`upd/${id}/${stamp()}.json`, { status: b.status });
      return res.status(200).json({ ok: true });
    }
    if (req.method === "DELETE") {
      const upd = await listPaths(`upd/${id}/`);
      await removePaths([`leads/${id}.json`, ...upd]);
      return res.status(200).json({ ok: true });
    }
    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ error: "method" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server" });
  }
}
