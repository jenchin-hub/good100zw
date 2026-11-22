// POST：聽眾送出資料（公開）。GET：管理者讀取全部名單。
import { writeJson } from "../lib/store.js";
import { currentAdmin } from "../lib/auth.js";
import { cleanLead, newId } from "../lib/leads.js";
import { hasDb, sql, toClient, insertClient, audit } from "../lib/db.js";
import { legacyRows } from "../lib/legacy.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "POST") {
      const b = req.body;
      if (b && b.hp) return res.status(200).json({ id: null }); // 隱藏欄位被填 = 機器人，假裝成功
      const lead = cleanLead(b);
      if (!lead) return res.status(400).json({ error: "invalid" });
      const id = newId();
      if (hasDb()) {
        await insertClient(id, lead);
        await audit("客戶本人", "create", lead.session ? "場次 " + lead.session : "", { id, name: lead.name });
      } else {
        await writeJson(`leads/${id}.json`, { ...lead, createdAt: new Date().toISOString(), consentAt: new Date().toISOString() });
      }
      return res.status(200).json({ id });
    }
    if (req.method === "GET") {
      if (!currentAdmin(req)) return res.status(401).json({ error: "unauthorized" });
      if (!hasDb()) return res.status(200).json({ leads: await legacyRows(), db: false });
      const rows = await sql(
        `select c.*, (select count(*)::int from notes n where n.client_id=c.id) as note_count from clients c order by c.created_at desc`);
      return res.status(200).json({ leads: rows.map((r) => ({ ...toClient(r), noteCount: r.note_count })), db: true });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server" });
  }
}
