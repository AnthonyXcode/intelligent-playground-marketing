# Intelligent Playground 智能運動場 — 宣傳網站

Vite + React + TypeScript。正式網址：https://www.intelligent-playground.com/

## 開發

```bash
npm install
npm run dev        # http://localhost:5173
```

## 建置及預覽

```bash
npm run build      # tsc 檢查 → 客戶端建置 → SSR 建置 → 預渲染到 dist/index.html
npm run preview    # http://localhost:4173
npm run test:mailto
```

`npm run build` 會把完整頁面 HTML 預先寫入 `dist/index.html`（方便搜尋器及未開 JavaScript 的瀏覽器），瀏覽器載入後再以 `hydrateRoot` 接手。

- 內容資料（運動項目、FAQ、功能、資助）：`src/content.ts`
- 各區塊：`src/components/`
- 圖片：`public/assets/`（網址維持 `assets/...`）；Vite 產生的檔案放在 `dist/static/`
- 「預約到校示範」表單會開啟使用者的電郵程式（mailto: anthonychan@antapp.ai），沒有後端。
- 頁尾「私隱政策」連結指向 https://www.ant-app.com/privacyPolicy

## 部署

所有平台：建置指令 `npm run build`，輸出目錄 `dist`，Node 22。

- **Vercel**：匯入此資料夾（Root Directory 設為 `marketing/app`），設定已在 `vercel.json`。於 Domains 加入 `www.intelligent-playground.com` 及 `intelligent-playground.com`，把 apex 設為 redirect 到 www。
- **Netlify**：匯入專案，Base directory 設為 `marketing/app`，設定已在 `netlify.toml`（包括 apex → www 的 301）。把 `www.intelligent-playground.com` 設為 Primary domain。
- **Cloudflare Pages**：Framework preset 選 None，Root directory `marketing/app`，Build command `npm run build`，Output `dist`。Headers 由 `public/_headers` 提供。Apex → www 需在 Cloudflare 用 Bulk Redirects / Redirect Rule 設定。

## DNS

- `www.intelligent-playground.com` 現時 CNAME 到 `ghs.googlehosted.com`（Google 代管），上線時須改為新平台提供的目標（例如 Vercel `cname.vercel-dns.com`、Netlify `<site>.netlify.app`、Cloudflare Pages `<project>.pages.dev`）。
- Apex `intelligent-playground.com` 現時 A 記錄指向 `167.71.203.118`，須改為新平台的 apex 設定（A / ALIAS / CNAME flattening），並在平台上把 apex 轉址到 www。
