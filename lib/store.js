// 名單儲存層：正式環境用 Vercel 私有 Blob；本機沒有金鑰時改寫到 .data/ 資料夾方便測試。
import { put, list, get, del } from "@vercel/blob";
import fs from "node:fs/promises";
import path from "node:path";

const useBlob = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
// 在 Vercel 上沒連到 Blob 時，等到真的要讀寫才報錯，這樣登入狀態查詢與健康檢查仍可運作
function ready() {
  if (!useBlob && process.env.VERCEL) throw new Error("Blob store is not connected to this project");
}
const DIR = path.join(process.cwd(), ".data");

export async function writeJson(pathname, obj) {
  ready();
  const body = JSON.stringify(obj);
  if (useBlob) {
    await put(pathname, body, { access: "private", contentType: "application/json", addRandomSuffix: false });
    return;
  }
  const f = path.join(DIR, pathname);
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(f, body, { flag: "wx" });
}

export async function readJson(pathname) {
  ready();
  if (useBlob) {
    const r = await get(pathname, { access: "private", useCache: false });
    if (!r || !r.stream) return null;
    return JSON.parse(await new Response(r.stream).text());
  }
  try { return JSON.parse(await fs.readFile(path.join(DIR, pathname), "utf8")); } catch { return null; }
}

export async function listPaths(prefix) {
  ready();
  if (useBlob) {
    const out = [];
    let cursor;
    do {
      const r = await list({ prefix, cursor, limit: 1000 });
      for (const b of r.blobs) out.push(b.pathname);
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    return out.sort();
  }
  const out = [];
  async function walk(rel) {
    let ents;
    try { ents = await fs.readdir(path.join(DIR, rel), { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) await walk(p); else out.push(p);
    }
  }
  await walk("");
  return out.filter((p) => p.startsWith(prefix)).sort();
}

export async function removePaths(paths) {
  ready();
  if (!paths.length) return;
  if (useBlob) { await del(paths); return; }
  for (const p of paths) await fs.rm(path.join(DIR, p), { force: true });
}

// 一次讀很多檔，限制同時連線數
export async function readMany(paths, limit = 12) {
  const out = new Array(paths.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, paths.length) }, async () => {
    while (i < paths.length) { const k = i++; out[k] = await readJson(paths[k]); }
  }));
  return out;
}
