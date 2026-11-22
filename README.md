# 谷吉爸紫微

演講現場分享給聽眾的紫微斗數排盤網站。聽眾掃 QR code 填寫生辰，馬上看到命盤與簡短解讀；管理者在後台看名單，接續詳細解析與流年分析服務。

## 功能

- 首頁內容區塊：認識紫微斗數、認識谷吉爸老師、服務項目、永定五號 論命美學館（地圖與交通），另有隱私權政策頁（`/privacy`）
- 首頁與填寫頁：姓名、性別、國曆/農曆（含閏月）、時辰、手機、Email、LINE ID（選填）、個資同意
- 命盤頁：十二宮盤面，每宮列出全部主星、輔星、雜曜與長生、博士、歲前、將前十二神；點選宮位顯示三方四正（本宮橘色，三方與對宮黃色）
- 本命盤／大限／流年切換，生年四化可顯示或隱藏，三層四化以形狀區分
- 命宮主星、身宮、生年四化的簡短文字解讀
- 需求按鈕：本命全解析、大限流年規劃、流月詳批（可複選）
- 命盤下載：聽眾與管理者都可以把命盤存成 JPG 或 PDF（在瀏覽器內用 canvas 繪製，不經過伺服器）
- 後台（`/admin`，需登入）：客戶名單可搜尋，並依場次、狀態、需求篩選；下載 CSV；產生場次連結與 QR code
- 客戶檔案：每位客戶一頁，含命盤、聯絡方式、需求、處理狀態、處理人、備註，可修改資料（例如補上出生時辰）
- 訪談紀錄：每位客戶可新增多筆，含訪談日期、類型（命盤解析、流年、其他）與內文；內容在 ChatGPT Project 整理好後貼上，網站本身不呼叫 AI
- 匯出：客戶檔案可匯出「命盤＋訪談紀錄」A4 多頁 PDF，每頁有表頭（文件編號、頁次）與頁尾；不含聯絡方式與內部備註
- 操作紀錄：誰在什麼時候查看、修改、備註、刪除、匯出，都會記錄

## 架構（Vercel）

| 路徑 | 用途 |
| --- | --- |
| `public/index.html` | 整個前台與後台畫面（單一檔案） |
| `public/privacy.html` | 隱私權政策 |
| `public/img/` | 圖片（老師照片） |
| `public/vendor/` | 排盤程式庫 iztro 2.6.5、QR code 程式庫 qrcode-generator（皆為 MIT 授權） |
| `api/leads.js` | `POST` 聽眾送出資料（公開）；`GET` 讀取全部名單（管理者） |
| `api/want.js` | `POST` 聽眾標記想要詳細解析或流年分析 |
| `api/admin.js` | 管理者登入、登出、匯入舊名單；資料庫未接上時的舊版狀態與刪除 |
| `api/client.js` | 客戶檔案：讀取、修改、備註、刪除，每個動作寫入紀錄 |
| `lib/db.js` | 資料庫層：Postgres（Neon）；本機沒有連線字串時用 PGlite，資料放在 `.data/pg` |
| `lib/legacy.js` | 讀取舊版 Blob 名單，供資料庫未接上時顯示，以及搬資料用 |
| `lib/store.js` | 儲存層：Vercel 私有 Blob；本機沒有金鑰時寫到 `.data/` |
| `lib/auth.js` | Email 白名單、密碼雜湊（scrypt）、簽章 cookie |
| `prototype-artifact.html` | 第一版原型（Claude artifact 版），僅供參考 |

資料存在 Postgres，共五張表：`clients`（客戶）、`sessions`（訪談紀錄）、`notes`（備註）、`audit`（操作紀錄）、`meta`（系統設定）。資料表在第一次連線時自動建立。

還沒設定 `DATABASE_URL` 時，網站會退回舊版：名單寫在私有 Blob（`leads/<編號>.json`、`upd/<編號>/...`），後台只有簡單名單。接上資料庫後，後台會出現「匯入舊名單」按鈕，把 Blob 裡的名單搬進資料庫（可重複執行，舊檔保留當備份）。

## 環境變數

| 名稱 | 說明 |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | 把 Blob 儲存空間連到專案時 Vercel 會自動建立 |
| `DATABASE_URL` | Postgres 連線字串。在 Vercel 的 Storage 建立 Neon 資料庫並連到專案時會自動建立 |
| `SESSION_SECRET` | 登入 cookie 的簽章金鑰，至少 32 個字元的亂數 |
| `ADMIN_HASHES` | 管理者白名單與密碼雜湊，JSON 格式，用下面的指令產生 |

新增管理者或更換密碼：

```
node scripts/hash-password.mjs 信箱一 密碼一 信箱二 密碼二
```

把印出的整行貼到 `ADMIN_HASHES`，重新部署後生效。從白名單移除的人會立刻被登出。

## 本機測試

```
npm install
SESSION_SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))') \
ADMIN_HASHES=$(node scripts/hash-password.mjs me@example.com 我的密碼) \
npm run dev
```

開 `http://localhost:3000`，後台在 `http://localhost:3000/admin`。

## 場次連結

網址加上 `?s=場次代碼`（例如 `/?s=taipei-1120`），名單上會標出場次。後台可以直接產生連結與 QR code。

## 待辦

- 流月、流日、流時、小限
- 確認庚干四化派別（目前為太陽祿、武曲權、太陰科、天同忌）
- 以已知命盤核對排盤結果；解讀文字改為谷吉爸自己的說法
- 公開送出端點目前只有隱藏欄位防機器人，流量大時可加上頻率限制
