// 客戶檔案（管理者專用）：GET 讀取單一客戶、PATCH 修改、POST 備註、DELETE 刪除。每個動作都寫入紀錄。
import { currentAdmin, sameOrigin, listAdmins } from "../lib/auth.js";
import { ID_RE, STATUS, SESSION_KINDS, cleanLead } from "../lib/leads.js";
import { hasDb, sql, toClient, audit } from "../lib/db.js";

const WANT = { wantDetail: ["want_detail", "本命全解析"], wantYearly: ["want_yearly", "大限流年規劃"], wantMonthly: ["want_monthly", "流月詳批"] };
const FIELD = { name: "姓名", gender: "性別", cal: "曆法", y: "年", m: "月", d: "日", leap: "閏月", t: "時辰", phone: "手機", email: "Email", line: "LINE ID" };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const me = currentAdmin(req);
    if (!me) return res.status(401).json({ error: "unauthorized" });
    if (!hasDb()) return res.status(503).json({ error: "no_db" });
    if (req.method !== "GET" && !sameOrigin(req)) return res.status(403).json({ error: "origin" });
    const b = req.body || {};
    const id = req.method === "GET" || req.method === "DELETE" ? req.query.id : b.id;
    if (typeof id !== "string" || !ID_RE.test(id)) return res.status(400).json({ error: "invalid" });
    const found = await sql("select * from clients where id=$1", [id]);
    if (!found.length) return res.status(404).json({ error: "not_found" });
    const row = found[0];
    const ref = { id, name: row.name };

    if (req.method === "GET") {
      await audit(me, "view", "", ref);
      return res.status(200).json(await bundle(id));
    }

    if (req.method === "PATCH") {
      const sets = [], vals = [], changes = [];
      const set = (col, v) => { vals.push(v); sets.push(`${col}=$${vals.length}`); };
      if (b.status !== undefined) {
        if (!STATUS.includes(b.status)) return res.status(400).json({ error: "invalid" });
        if (b.status !== row.status) { set("status", b.status); changes.push(`狀態：${row.status} → ${b.status}`); }
      }
      if (b.assignee !== undefined) {
        if (b.assignee !== "" && !listAdmins().includes(b.assignee)) return res.status(400).json({ error: "invalid" });
        if (b.assignee !== row.assignee) { set("assignee", b.assignee); changes.push(`處理人：${row.assignee || "未指派"} → ${b.assignee || "未指派"}`); }
      }
      for (const k of Object.keys(WANT)) {
        if (b[k] === undefined) continue;
        if (typeof b[k] !== "boolean") return res.status(400).json({ error: "invalid" });
        if (b[k] !== row[WANT[k][0]]) { set(WANT[k][0], b[k]); changes.push(`${b[k] ? "加上" : "取消"}需求：${WANT[k][1]}`); }
      }
      if (b.fields !== undefined) {
        const lead = cleanLead({ ...b.fields, session: row.session, agree: true });
        if (!lead) return res.status(400).json({ error: "invalid_fields" });
        const edited = [];
        for (const k of Object.keys(FIELD)) if (lead[k] !== row[k]) { set(k, lead[k]); edited.push(FIELD[k]); }
        if (edited.length) changes.push("修改資料：" + edited.join("、"));
      }
      if (sets.length) {
        vals.push(id);
        await sql(`update clients set ${sets.join(", ")}, updated_at=now() where id=$${vals.length}`, vals);
        await audit(me, "edit", changes.join("；"), { id, name: row.name });
      }
      return res.status(200).json(await bundle(id));
    }

    if (req.method === "POST") {
      if (b.action === "note") {
        const body = typeof b.body === "string" ? b.body.trim() : "";
        if (!body || body.length > 5000) return res.status(400).json({ error: "invalid" });
        await sql("insert into notes (client_id, author, body) values ($1,$2,$3)", [id, me, body]);
        await sql("update clients set updated_at=now() where id=$1", [id]);
        await audit(me, "note", "新增備註", ref);
        return res.status(200).json(await bundle(id));
      }
      if (b.action === "session_add" || b.action === "session_edit") {
        const body = typeof b.body === "string" ? b.body.trim() : "";
        const date = typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) && !isNaN(Date.parse(b.date)) ? b.date : null;
        if (!body || body.length > 50000 || !date || !SESSION_KINDS.includes(b.kind)) return res.status(400).json({ error: "invalid" });
        if (b.action === "session_add") {
          await sql("insert into sessions (client_id, held_on, kind, body, author, updated_by) values ($1,$2,$3,$4,$5,$5)", [id, date, b.kind, body, me]);
          await audit(me, "session", `新增訪談紀錄：${date} ${b.kind}`, ref);
        } else {
          const r = await sql("update sessions set held_on=$1, kind=$2, body=$3, updated_by=$4, updated_at=now() where id=$5 and client_id=$6 returning id",
            [date, b.kind, body, me, Number(b.sessionId) || 0, id]);
          if (!r.length) return res.status(404).json({ error: "not_found" });
          await audit(me, "session", `修改訪談紀錄：${date} ${b.kind}`, ref);
        }
        await sql("update clients set updated_at=now() where id=$1", [id]);
        return res.status(200).json(await bundle(id));
      }
      if (b.action === "session_delete") {
        const r = await sql("delete from sessions where id=$1 and client_id=$2 returning held_on::text as held_on, kind", [Number(b.sessionId) || 0, id]);
        if (r.length) await audit(me, "session", `刪除訪談紀錄：${day(r[0].held_on)} ${r[0].kind}`, ref);
        return res.status(200).json(await bundle(id));
      }
      if (b.action === "log_export") {
        await audit(me, "export", "匯出命盤與訪談紀錄 PDF", ref);
        return res.status(200).json({ ok: true });
      }
      if (b.action === "note_delete") {
        const r = await sql("delete from notes where id=$1 and client_id=$2 returning id", [Number(b.noteId) || 0, id]);
        if (r.length) await audit(me, "note", "刪除備註", ref);
        return res.status(200).json(await bundle(id));
      }
      return res.status(400).json({ error: "invalid" });
    }

    if (req.method === "DELETE") {
      await sql("delete from clients where id=$1", [id]);
      await audit(me, "delete", "刪除客戶檔案", ref);
      return res.status(200).json({ ok: true });
    }
    res.setHeader("Allow", "GET, PATCH, POST, DELETE");
    return res.status(405).json({ error: "method" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server" });
  }
}

// 資料庫的 date 欄位 → "YYYY-MM-DD"（不經過時區換算）
const day = (v) => (v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}` : String(v).slice(0, 10));

async function bundle(id) {
  const [c, notes, log, sess] = await Promise.all([
    sql("select * from clients where id=$1", [id]),
    sql("select id, author, body, created_at from notes where client_id=$1 order by created_at desc", [id]),
    sql("select actor, action, detail, at from audit where client_id=$1 order by at desc, id desc limit 60", [id]),
    sql("select id, held_on::text as held_on, kind, body, author, updated_by, created_at, updated_at from sessions where client_id=$1 order by held_on desc, id desc", [id]),
  ]);
  return {
    client: toClient(c[0]),
    notes: notes.map((n) => ({ id: Number(n.id), author: n.author, body: n.body, createdAt: n.created_at })),
    audit: log,
    sessions: sess.map((x) => ({ id: Number(x.id), date: day(x.held_on), kind: x.kind, body: x.body, author: x.author, updatedBy: x.updated_by, createdAt: x.created_at, updatedAt: x.updated_at })),
    kinds: SESSION_KINDS,
    admins: listAdmins(),
  };
}
