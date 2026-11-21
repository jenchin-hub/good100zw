// 本機測試用的小伺服器：npm run dev，然後開 http://localhost:3000
// 沒有 Blob 金鑰時，名單會寫到 .data/ 資料夾。
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const PORT = process.env.PORT || 3000;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
  try {
    if (url.pathname.startsWith("/api/")) {
      const name = url.pathname.slice(5).replace(/[^a-z]/g, "");
      const mod = await import(`../api/${name}.js`);
      let raw = ""; for await (const c of req) raw += c;
      try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
      req.query = Object.fromEntries(url.searchParams);
      return await mod.default(req, res);
    }
    let p = url.pathname === "/" || url.pathname === "/admin" ? "/index.html" : url.pathname === "/privacy" ? "/privacy.html" : url.pathname;
    const f = path.join(process.cwd(), "public", path.normalize(p));
    const data = await fs.readFile(f);
    res.setHeader("Content-Type", TYPES[path.extname(f)] || "application/octet-stream");
    res.end(data);
  } catch (e) { res.statusCode = 404; res.end("not found"); }
}).listen(PORT, () => console.log("http://localhost:" + PORT));
