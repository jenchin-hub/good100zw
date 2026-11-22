// 設定檢查：只回報各項設定「有沒有」，不會回傳任何內容。
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  let admins = 0;
  try { admins = Object.keys(JSON.parse(process.env.ADMIN_HASHES || "{}")).length; } catch { admins = -1; }
  res.status(200).json({
    blob: !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID),
    database: !!(process.env.DATABASE_URL || process.env.POSTGRES_URL),
    sessionSecret: (process.env.SESSION_SECRET || "").length >= 32,
    admins,
  });
}
