import crypto from "node:crypto";

export const STATUS = ["未聯絡", "已聯絡", "已完成"];
export const SESSION_KINDS = ["命盤解析", "流年", "其他"];
export const ID_RE = /^[0-9]{13}-[a-f0-9]{24}$/;
export const newId = () => String(Date.now()).padStart(13, "0") + "-" + crypto.randomBytes(12).toString("hex");
export const stamp = () => String(Date.now()).padStart(13, "0") + "-" + crypto.randomBytes(4).toString("hex");

const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

// 檢查聽眾送來的資料，只留下允許的欄位
export function cleanLead(b) {
  if (!b || typeof b !== "object") return null;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const phone = typeof b.phone === "string" ? b.phone.replace(/[\s-]/g, "") : "";
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const session = typeof b.session === "string" ? b.session : "";
  const line = typeof b.line === "string" ? b.line.trim().replace(/^@/, "") : "";
  if (!name || name.length > 30) return null;
  if (b.gender !== "男" && b.gender !== "女") return null;
  if (b.cal !== "solar" && b.cal !== "lunar") return null;
  if (!int(b.y, 1900, new Date().getFullYear()) || !int(b.m, 1, 12) || !int(b.d, 1, 31)) return null;
  if (!int(b.t, -1, 12)) return null;
  if (!/^\+?\d{8,15}$/.test(phone)) return null;
  if (email.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (!/^[A-Za-z0-9-]{0,40}$/.test(session)) return null;
  if (!/^[A-Za-z0-9._-]{0,30}$/.test(line)) return null; // LINE ID 選填
  if (b.agree !== true) return null;
  return { name, gender: b.gender, cal: b.cal, y: b.y, m: b.m, d: b.d, leap: b.cal === "lunar" && b.leap === true, t: b.t, phone, email, line, session };
}
