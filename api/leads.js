// POST：聽眾送出資料（公開）。GET：管理者讀取全部名單。
import { writeJson, listPaths, readMany } from "../lib/store.js";
import { currentAdmin } from "../lib/auth.js";
import { cleanLead, newId, STATUS } from "../lib/leads.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "POST") {
      const b = req.body;
      if (b && b.hp) return res.status(200).json({ id: null }); // 隱藏欄位被填 = 機器人，假裝成功
      const lead = cleanLead(b);
      if (!lead) return res.status(400).json({ error: "invalid" });
      const id = newId();
      await writeJson(`leads/${id}.json`, { ...lead, createdAt: new Date().toISOString(), consentAt: new Date().toISOString() });
      return res.status(200).json({ id });
    }
    if (req.method === "GET") {
      if (!currentAdmin(req)) return res.status(401).json({ error: "unauthorized" });
      const [leadPaths, updPaths] = await Promise.all([listPaths("leads/"), listPaths("upd/")]);
      const [leads, upds] = await Promise.all([readMany(leadPaths), readMany(updPaths)]);
      const map = new Map();
      leadPaths.forEach((p, i) => {
        if (!leads[i]) return;
        const id = p.slice(6, -5);
        map.set(id, { id, status: STATUS[0], wantDetail: false, wantYearly: false, wantMonthly: false, ...leads[i] });
      });
      updPaths.forEach((p, i) => { // 路徑以時間開頭，排序後依序套用
        const row = map.get(p.split("/")[1]);
        const u = upds[i];
        if (!row || !u) return;
        if (STATUS.includes(u.status)) row.status = u.status;
        if (u.wantDetail === true) row.wantDetail = true;
        if (u.wantYearly === true) row.wantYearly = true;
        if (u.wantMonthly === true) row.wantMonthly = true;
      });
      const rows = [...map.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return res.status(200).json({ leads: rows });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server" });
  }
}
