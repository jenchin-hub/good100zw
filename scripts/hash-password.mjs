// 產生管理者密碼雜湊：node scripts/hash-password.mjs 信箱 密碼 [信箱 密碼 ...]
// 把印出來的整行 JSON 貼到 Vercel 環境變數 ADMIN_HASHES。
import { hashPassword } from "../lib/auth.js";
const a = process.argv.slice(2);
if (!a.length || a.length % 2) { console.error("用法：node scripts/hash-password.mjs 信箱 密碼 [信箱 密碼 ...]"); process.exit(1); }
const out = {};
for (let i = 0; i < a.length; i += 2) out[a[i].trim().toLowerCase()] = hashPassword(a[i + 1]);
console.log(JSON.stringify(out));
