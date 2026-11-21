// 管理者：GET 查登入狀態、POST 登入／登出、PATCH 改處理狀態、DELETE 刪除名單。
import { writeJson, readJson, listPaths, removePaths } from "../lib/store.js";
import { checkLogin, sessionCookie, clearCookie, currentAdmin, sameOrigin } from "../lib/auth.js";
import { ID_RE, STATUS, stamp } from "../lib/leads.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const email = currentAdmin(req);
      return email ? res.status(200).json({ email }) : res.status(401).json({ error: "unauthorized" });
    }
    if (!sameOrigin(req)) return res.status(403).json({ error: "origin" });
    const b = req.body || {};
    if (req.method === "POST") {
      if (b.action === "logout") { res.setHeader("Set-Cookie", clearCookie()); return res.status(200).json({ ok: true }); }
      if (b.action !== "login") return res.status(400).json({ error: "invalid" });
      const email = checkLogin(b.email, b.password);
      if (!email) { await wait(800); return res.status(401).json({ error: "bad_login" }); }
      res.setHeader("Set-Cookie", sessionCookie(email));
      return res.status(200).json({ email });
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
