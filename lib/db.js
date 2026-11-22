// 資料庫層：正式環境連 Postgres（Neon，讀 DATABASE_URL）；本機沒有連線字串時用內建的 PGlite，資料放在 .data/pg。
// Vercel 上還沒接資料庫時 hasDb() 為 false，網站會退回舊的 Blob 名單，不會壞掉。
import path from "node:path";

const URL_ = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
export const hasDb = () => !process.env.FORCE_LEGACY && (!!URL_ || !process.env.VERCEL);

const SCHEMA = [
  `create table if not exists clients (
    id text primary key, name text not null, gender text not null, cal text not null,
    y int not null, m int not null, d int not null, leap boolean not null default false, t int not null,
    phone text not null default '', email text not null default '', line text not null default '', session text not null default '',
    status text not null default '未聯絡', assignee text not null default '',
    want_detail boolean not null default false, want_yearly boolean not null default false, want_monthly boolean not null default false,
    created_at timestamptz not null default now(), consent_at timestamptz, updated_at timestamptz not null default now())`,
  `create table if not exists notes (
    id bigserial primary key, client_id text not null references clients(id) on delete cascade,
    author text not null, body text not null, created_at timestamptz not null default now())`,
  `create index if not exists notes_client on notes(client_id, created_at desc)`,
  `create table if not exists audit (
    id bigserial primary key, client_id text, client_name text not null default '', actor text not null,
    action text not null, detail text not null default '', at timestamptz not null default now())`,
  `create index if not exists audit_client on audit(client_id, at desc)`,
  `create table if not exists meta (key text primary key, value text not null)`,
];

let ready;
async function connect() {
  let run;
  if (URL_) {
    const { neon } = await import("@neondatabase/serverless");
    const q = neon(URL_);
    run = (text, params = []) => q.query(text, params);
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const fs = await import("node:fs");
    fs.mkdirSync(path.join(process.cwd(), ".data"), { recursive: true });
    const db = new PGlite(path.join(process.cwd(), ".data", "pg"));
    run = async (text, params = []) => (await db.query(text, params)).rows;
  }
  for (const s of SCHEMA) await run(s);
  return run;
}

// sql("select ... where id=$1", [id]) → 回傳資料列陣列
export async function sql(text, params) {
  if (!hasDb()) throw new Error("database is not connected");
  if (!ready) ready = connect().catch((e) => { ready = null; throw e; });
  return (await ready)(text, params);
}

export const audit = (actor, action, detail = "", client = null) =>
  sql("insert into audit (client_id, client_name, actor, action, detail) values ($1,$2,$3,$4,$5)",
    [client ? client.id : null, client ? client.name : "", actor, action, detail]);

// 資料列 → 前端用的欄位名稱
export const toClient = (r) => ({
  id: r.id, name: r.name, gender: r.gender, cal: r.cal, y: r.y, m: r.m, d: r.d, leap: r.leap, t: r.t,
  phone: r.phone, email: r.email, line: r.line, session: r.session, status: r.status, assignee: r.assignee,
  wantDetail: r.want_detail, wantYearly: r.want_yearly, wantMonthly: r.want_monthly,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export async function insertClient(id, lead, extra = {}) {
  const now = new Date().toISOString();
  return sql(
    `insert into clients (id,name,gender,cal,y,m,d,leap,t,phone,email,line,session,status,want_detail,want_yearly,want_monthly,created_at,consent_at,updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$18)
     on conflict (id) do nothing returning id`,
    [id, lead.name, lead.gender, lead.cal, lead.y, lead.m, lead.d, !!lead.leap, lead.t, lead.phone || "", lead.email || "", lead.line || "", lead.session || "",
      extra.status || "未聯絡", !!extra.wantDetail, !!extra.wantYearly, !!extra.wantMonthly, extra.createdAt || now, extra.consentAt || extra.createdAt || now]);
}
