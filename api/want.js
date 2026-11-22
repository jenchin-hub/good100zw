// 聽眾點選想預約的服務。用送出資料時拿到的編號識別，編號無法猜測。
import { writeJson, readJson } from "../lib/store.js";
import { ID_RE, stamp } from "../lib/leads.js";
import { hasDb, sql, audit } from "../lib/db.js";

const KEYS = { detail: "wantDetail", yearly: "wantYearly", monthly: "wantMonthly" };
const COLS = { detail: "want_detail", yearly: "want_yearly", monthly: "want_monthly" };
const LABEL = { detail: "本命全解析", yearly: "大限流年規劃", monthly: "流月詳批" };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "method" }); }
    const { id, key } = req.body || {};
    if (typeof id !== "string" || !ID_RE.test(id) || !KEYS[key]) return res.status(400).json({ error: "invalid" });
    if (hasDb()) {
      const r = await sql(`update clients set ${COLS[key]}=true, updated_at=now() where id=$1 returning id, name`, [id]);
      if (!r.length) return res.status(404).json({ error: "not_found" });
      await audit("客戶本人", "want", "想預約：" + LABEL[key], r[0]);
      return res.status(200).json({ ok: true });
    }
    if (!(await readJson(`leads/${id}.json`))) return res.status(404).json({ error: "not_found" });
    await writeJson(`upd/${id}/${stamp()}.json`, { [KEYS[key]]: true });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server" });
  }
}
