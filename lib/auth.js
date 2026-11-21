// 管理者登入：Email 白名單 + 各自的密碼（scrypt 雜湊存在環境變數），登入後發簽章 cookie。
import crypto from "node:crypto";

const COOKIE = "gz_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 天

function admins() {
  // ADMIN_HASHES 格式：{"email":"saltHex:hashHex", ...}
  try { return JSON.parse(process.env.ADMIN_HASHES || "{}"); } catch { return {}; }
}
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET is missing");
  return s;
}
const sign = (data) => crypto.createHmac("sha256", secret()).update(data).digest("base64url");
const safeEq = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return salt + ":" + crypto.scryptSync(password, Buffer.from(salt, "hex"), 32).toString("hex");
}

export function checkLogin(email, password) {
  const e = String(email || "").trim().toLowerCase();
  const stored = admins()[e];
  // 帳號不存在時也跑一次雜湊，避免從回應時間看出哪個 Email 在白名單
  const [salt, hash] = (stored || "00000000000000000000000000000000:" + "0".repeat(64)).split(":");
  const got = crypto.scryptSync(String(password || ""), Buffer.from(salt, "hex"), 32).toString("hex");
  return stored && safeEq(got, hash) ? e : null;
}

export function sessionCookie(email) {
  const payload = Buffer.from(JSON.stringify({ e: email, x: Math.floor(Date.now() / 1000) + MAX_AGE })).toString("base64url");
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export function currentAdmin(req) {
  const m = /(?:^|;\s*)gz_session=([^;]+)/.exec(req.headers.cookie || "");
  if (!m) return null;
  const [payload, sig] = m[1].split(".");
  if (!payload || !sig || !safeEq(sig, sign(payload))) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (p.x < Date.now() / 1000) return null;
    return admins()[p.e] ? p.e : null; // 從白名單移除後，舊 cookie 立刻失效
  } catch { return null; }
}

// 會改資料的請求必須來自本站頁面
export function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return false;
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}
