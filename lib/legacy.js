// 舊版名單（存在 Blob 的 JSON 檔）：資料庫接上前仍用它，接上後用來搬資料。
import { listPaths, readMany } from "./store.js";
import { STATUS } from "./leads.js";

export async function legacyRows() {
  const [leadPaths, updPaths] = await Promise.all([listPaths("leads/"), listPaths("upd/")]);
  const [leads, upds] = await Promise.all([readMany(leadPaths), readMany(updPaths)]);
  const map = new Map();
  leadPaths.forEach((p, i) => {
    if (!leads[i]) return;
    const id = p.slice(6, -5);
    map.set(id, { id, status: STATUS[0], wantDetail: false, wantYearly: false, wantMonthly: false, ...leads[i] });
  });
  updPaths.forEach((p, i) => { // 路徑以時間開頭，排序後依序套用
    const row = map.get(p.split("/")[1]);
    const u = upds[i];
    if (!row || !u) return;
    if (STATUS.includes(u.status)) row.status = u.status;
    if (u.wantDetail === true) row.wantDetail = true;
    if (u.wantYearly === true) row.wantYearly = true;
    if (u.wantMonthly === true) row.wantMonthly = true;
  });
  return [...map.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
