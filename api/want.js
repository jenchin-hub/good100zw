// 聽眾點「我想要詳細解析／流年分析」。用送出資料時拿到的編號識別，編號無法猜測。
import { writeJson, readJson } from "../lib/store.js";
import { ID_RE, stamp } from "../lib/leads.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method" }); }
    const { id, key } = req.body || {};
    if (typeof id !== "string" || !ID_RE.test(id) || (key !== "detail" && key !== "yearly")) return res.status(400).json({ error: "invalid" });
    if (!(await readJson(`leads/${id}.json`))) return res.status(404).json({ error: "not_found" });
    await writeJson(`upd/${id}/${stamp()}.json`, key === "detail" ? { wantDetail: true } : { wantYearly: true });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server" });
  }
}
