# 谷吉爸紫微

演講現場分享給聽眾的紫微斗數排盤網站。聽眾掃 QR code 填寫生辰，馬上看到命盤與簡短解讀；管理者在後台看名單，接續詳細解析與流年分析服務。

## 功能

- 首頁與填寫頁：姓名、性別、國曆/農曆（含閏月）、時辰、手機、Email、個資同意
- 命盤頁：十二宮盤面，點選宮位顯示三方四正（本宮橘色，三方與對宮黃色）
- 本命盤／大限／流年切換，生年四化可顯示或隱藏，三層四化以形狀區分
- 命宮主星、身宮、生年四化的簡短文字解讀
- 需求按鈕：詳細命盤解析、流年分析
- 名單後台（`/admin`，需登入）：名單、需求標記、處理狀態、看命盤、下載 CSV、刪除、產生場次連結與 QR code

## 架構（Vercel）

| 路徑 | 用途 |
| --- | --- |
| `public/index.html` | 整個前台與後台畫面（單一檔案） |
| `public/vendor/` | 排盤程式庫 iztro 2.6.5、QR code 程式庫 qrcode-generator（皆為 MIT 授權） |
| `api/leads.js` | `POST` 聽眾送出資料（公開）；`GET` 讀取全部名單（管理者） |
| `api/want.js` | `POST` 聽眾標記想要詳細解析或流年分析 |
| `api/admin.js` | 管理者登入、登出、改處理狀態、刪除名單 |
| `lib/store.js` | 儲存層：Vercel 私有 Blob；本機沒有金鑰時寫到 `.data/` |
| `lib/auth.js` | Email 白名單、密碼雜湊（scrypt）、簽章 cookie |
| `prototype-artifact.html` | 第一版原型（Claude artifact 版），僅供參考 |

名單資料存在私有 Blob：每筆名單一個檔（`leads/<編號>.json`），需求標記與狀態變更各寫一個小檔（`upd/<編號>/...`），讀取時合併。

## 環境變數

| 名稱 | 說明 |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | 把 Blob 儲存空間連到專案時 Vercel 會自動建立 |
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
