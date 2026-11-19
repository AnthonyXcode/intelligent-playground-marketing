# 學校電郵推廣自動化（智能運動場）

由 `anthonychan@antapp.ai`（Google Workspace）向全港幼稚園、小學、中學及特殊學校發出智能運動場推廣電郵。
學校未回覆時，系統逢星期二、五以 AI（Claude CLI）撰寫新主題的跟進電郵，在同一電郵串回覆；
學校回覆、取消訂閱、電郵退回，或累計收到 **10 封**（1 封首次電郵＋最多 9 封跟進）後即停止。
學校回覆的電郵會在 Gmail 加上標籤 **`IP/已回覆`**，由同事人手跟進。

所有指令都在 repo 根目錄執行。詳細技術規格見 `emails/SPEC.md`。

| 指令 | 用途 |
|---|---|
| `./emails/scripts/setup.sh` | 一次性設定（可重複執行）：檢查 Node、安裝套件、檢查 Claude CLI、Gmail 登入、建立標籤、建立資料庫、匯入學校、試行 dry-run |
| `./emails/scripts/start.sh` | 啟動排程（launchd）：逢星期二、五 10:00 寄出；每日 18:00 檢查回覆（香港時間） |
| `./emails/scripts/stops.sh`（或 `stop.sh`） | 停止並移除排程 |
| `./emails/scripts/status.sh` | 顯示狀態，並更新 `emails/state/report.html` |
| `./emails/scripts/run.sh` | 手動執行一次（排程亦是呼叫它） |

---

## 一、Google Cloud 設定（只需做一次）

需要用 antapp.ai Workspace 帳戶操作。

1. **建立專案**：打開 <https://console.cloud.google.com/>，頂部選擇專案 >「新增專案」，名稱例如 `ip-outreach`，機構選 `antapp.ai`，建立後切換到該專案。
2. **啟用 Gmail API**：左邊選單「API 和服務」>「程式庫」，搜尋 **Gmail API** >「啟用」。
3. **OAuth 同意畫面**：「API 和服務」>「OAuth 同意畫面」（新版介面叫「Google Auth Platform」>「品牌」）：
   - 使用者類型選 **內部（Internal）**：只限 antapp.ai 帳戶使用，毋須 Google 審核，token 亦不會每 7 日過期。
   - 應用程式名稱例如「IP Outreach」，支援電郵及開發人員電郵填 `anthonychan@antapp.ai`，儲存。
   - 範圍（Scopes）可不填；程式登入時會要求 `gmail.send` 及 `gmail.modify`。
4. **建立 OAuth 用戶端**：「API 和服務」>「憑證」>「建立憑證」>「OAuth 用戶端 ID」（新版：「用戶端」>「建立用戶端」）：
   - 應用程式類型選 **電腦版應用程式（Desktop app）**，名稱例如 `ip-outreach-mac`，建立。
5. **下載 JSON**：在剛建立的用戶端按「下載 JSON」，把檔案改名並放到：

   ```
   emails/secrets/client_secret.json
   ```

   `emails/secrets/` 已被 `.gitignore` 排除，**切勿 commit 或分享**此資料夾。

## 二、在執行排程的 Mac 上設定

1. 安裝 Homebrew 及 Node.js 22 或以上（如未安裝）：
   ```sh
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   brew install node@22 && brew link --overwrite node@22
   ```
2. 安裝 Claude CLI 並登入（只需一次）：
   ```sh
   curl -fsSL https://claude.ai/install.sh | bash
   claude        # 首次會要求登入；登入後輸入 /exit 離開
   ```
3. 把 `client_secret.json` 放到 `emails/secrets/`（見第一部分）。
4. 執行：
   ```sh
   ./emails/scripts/setup.sh
   ```
   程式會開啟瀏覽器，請以 **anthonychan@antapp.ai** 登入並按「允許」。成功後 token 存於
   `emails/secrets/token.json`（權限 600），之後會自動更新，毋須再登入。
   最後會以 3 間學校試行 dry-run（**不會寄出**），預覽在 `emails/state/outbox/`（`.html` 可直接用瀏覽器打開，`.eml` 可用「郵件」App 打開）。

npm 一律使用公開 registry（`emails/pipeline/.npmrc`：`registry=https://registry.npmjs.org/`、`save-exact=true`），
套件版本已鎖定（`package-lock.json`）。`setup.sh` 用 `npm ci --registry=https://registry.npmjs.org/`，不會用到電腦上全域 `~/.npmrc` 的私人 registry。

## 三、測試模式（正式開始前建議先做）

1. 在 `emails/config.json` 設定：
   ```json
   "testRecipient": "你的電郵@antapp.ai"
   ```
   所有電郵會改寄到這個地址，主旨前加「【測試】」，每次最多寄 `testMaxPerRun`（預設 3）封。
2. 執行 `./emails/scripts/run.sh`，檢查收到的電郵（格式、粗體、圖示、簽名、取消訂閱字句）。
   可在 Gmail 直接回覆測試電郵（例如「有興趣，想預約示範」），再執行 `./emails/scripts/run.sh --check-only`，確認該電郵串加上 `IP/已回覆` 標籤。
3. 測試完成後：
   ```sh
   ./emails/scripts/run.sh --reset-test     # 把測試寄出的學校還原為「未寄出」
   ```
   然後把 `testRecipient` 改回 `""`。

## 四、啟動、停止及查看狀態

```sh
./emails/scripts/start.sh     # 安裝 ~/Library/LaunchAgents/com.antapp.ip-outreach.plist 並啟動
./emails/scripts/status.sh    # 狀態摘要 + 產生 emails/state/report.html
./emails/scripts/stops.sh     # 停止排程（stop.sh 亦可）
```

- 排程時間在 `config.json` 的 `schedule`（預設星期二、五 10:00 寄出，每日 18:00 檢查回覆，香港時間）。
  如這部 Mac 的時區不是香港，`start.sh` 會自動換算並顯示警告；如當地有夏令時間，每次轉換後請再執行一次 `./emails/scripts/start.sh`。
- launchd 每次都呼叫 `run.sh --scheduled`：在寄出日 10:00 後（20:00 前）而當日未完成寄出，就會寄出；其他時間只檢查回覆。
  Mac 如在 10:00 時睡眠，會在喚醒後補做。建議在「系統設定 > 電池／能源」設定不自動睡眠，並保持登入。
- 修改 `config.json` 的排程後，再執行 `./emails/scripts/start.sh` 套用。
- `report.html`：可按級別、狀態篩選及搜尋的學校列表、回覆摘要及執行紀錄，用瀏覽器打開即可（不需網絡）。

### 手動執行

```sh
./emails/scripts/run.sh                  # 檢查回覆 + 寄出到期電郵
./emails/scripts/run.sh --dry-run        # 不寄出、不改 Gmail 標籤、不改狀態；預覽寫到 emails/state/outbox/
./emails/scripts/run.sh --dry-run --limit 3
./emails/scripts/run.sh --check-only     # 只檢查回覆
./emails/scripts/run.sh --retry-errors   # 把狀態為 error 的學校放回寄送隊列
```

### 預覽

- 整個 10 封序列（首次電郵＋9 封 AI 跟進，示例學校，不寄出）：
  ```sh
  python3 emails/scripts/preview-sequence.py emails/content <output.md> [KG|PRI|SEC|SPE]
  ```
- 實際名單下一次會寄甚麼：`./emails/scripts/run.sh --dry-run`，預覽在 `emails/state/outbox/`。

### 新一輪推廣（已達上限的學校）

學校收滿 10 封仍未回覆，狀態會變成 `no_response`（已達上限），之後不再寄出。日後如有優惠或新消息，可開始新一輪（campaign）：

```sh
./emails/scripts/run.sh --reactivate --campaign 2027-discount --dry-run   # 先看看有多少間
./emails/scripts/run.sh --reactivate --campaign 2027-discount [--level PRI]
```

- 這些學校會回到 `active`，重新有 10 封的額度；下一次寄出時會發出新一輪的首次電郵（**新的電郵串**），之後的跟進回覆在新電郵串內。舊紀錄全部保留。
- 新一輪可用另一套範本及主題：在 `config.json` 的 `campaigns` 加上
  `"2027-discount": { "templatesDir": "campaigns/2027-discount/templates", "topics": "campaigns/2027-discount/topics.json" }`
  （路徑在 `emails/content/` 之下，格式同 `templates/first-<級別>.md` 及 `topics.json`）；未設定則沿用原有範本及主題。
- **取消訂閱及退回的學校永遠不會重新啟動。** 已回覆的學校預設不會重新啟動，除非加上 `--include-replied`。
- 同一個 campaign 名稱重複執行不會重覆重設。

### 個人／免費郵箱（預設不寄）

`schools.csv` 的 `notes` 註明「免費郵箱」「可能為個人電郵」或「校長郵箱」的學校（約 85 間）可能是個人郵箱（《個人資料（私隱）條例》），
預設**不會**寄出，狀態為 `skipped_flagged`。如確認要寄，把 `config.json` 的 `includeFlaggedContacts` 改為 `true`，再執行
`cd emails/pipeline && node src/cli.mjs import`。同一電郵出現在多行時，只寄給第一行的學校。

### 更新學校名單

更新 `emails/data/schools.csv` 後執行 `./emails/scripts/setup.sh`（或 `cd emails/pipeline && node src/cli.mjs import`）。
重新匯入**不會**令已取消訂閱或電郵退回的學校再收到電郵（按學校 ID 及電郵地址記錄）。

### 網站瀏覽追蹤

電郵內所有 intelligent-playground.com 連結都會自動加上該校的參考編號（例如 `?r=k7Q2xP9a3B`，隨機產生，不含學校名稱）。學校打開網站並停留約 3 秒，網站會記錄一次「瀏覽」；在網站按「預約到校示範」會記錄一次「按預約示範」，而電郵內文會附上參考編號。

- 每次執行（包括每日 18:00 檢查）會讀取新瀏覽紀錄；`status.sh` 及 `report.html` 會顯示「曾瀏覽網站」的學校及最近瀏覽時間。
- 立即讀取：`cd emails/pipeline && node src/cli.mjs visits`
- 只知道是**哪間學校**，不知道是哪位老師（電郵被轉寄亦計入同一間學校）。
- 郵件保安掃描會自動打開連結：網站只在頁面真正顯示後才記錄，而寄出後 120 秒內的瀏覽不計（`config.json` 的 `tracking.ignoreSecondsAfterSend`）。
- 網站只儲存參考編號、時間及裝置類別（電腦／手機／平板），不儲存 IP 地址。
- 讀取紀錄需要 `emails/secrets/tracking.json`（`{"readKey": "..."}`，與 Vercel 的 `TRACKING_READ_KEY` 相同）。請從建立金鑰的 Mac 複製到執行排程的 Mac，`chmod 600`。不要提交到 Git。
- 關閉追蹤：`config.json` 設 `"tracking": { "enabled": false }`。

## 五、緊急停止（kill switch）

把 `emails/config.json` 的 `"enabled"` 改為 `false`：

- 下一次執行會立即結束，不寄出任何電郵。
- 正在寄出中的一次執行，會在寄下一封前重新讀取設定並停止。

亦可執行 `./emails/scripts/stops.sh` 移除排程。

## 六、寄送規則及安全

- 每間學校最多 10 封；兩封之間最少 `minDaysBetween`（3）日；每次最多 `maxPerRun`（150）封、每日最多 `maxPerDay`（400）封；每封之間隨機等候 20–60 秒。
- 每次先寄到期的跟進電郵，餘額才寄新學校的首次電郵（次序：小學、中學、特殊學校、幼稚園，再按地區）。
- 首次電郵用 `content/templates/first-<級別>.md`；跟進電郵由 Claude 按 `content/topics.json` 的下一個未用主題撰寫（只用 `content/facts.md` 的事實），第 10 封（即第 9 封跟進）固定用 `final: true` 的收結主題（內容不會說是最後一封，方便日後再推廣）。
- 簽名、公司地址、取消訂閱字句及 NOTICE 由程式從 `content/signature.md` 加上，AI 不會寫。
- 每封寄出前檢查：沒有未填的 `{{…}}`、`**` 成對、沒有技術／供應商名稱（Google、ML Kit、MediaPipe、RK3588、Android、Flutter、Strapi）、沒有未核實功能（徽章、獎勵、社交媒體分享、團隊挑戰、家長短訊等，見 `config.json` 的 `bannedClaims`）、長度限制、主旨不為空。不合格就不寄，該學校標記為 `error`。
- 回覆處理：有興趣、查詢、婉拒、其他真人回覆 → `replied`（停止寄送，加 `IP/已回覆` 標籤）；取消訂閱 → `unsubscribed`（永久停止，加 `IP/取消訂閱` 標籤）；退回 → `bounced`；自動回覆（休假等）不算回覆。
- 根據《非應邀電子訊息條例》，收到取消訂閱要求後須在 10 個工作天內停止發送；系統會即時停止並永久保留取消名單（`state/outreach.db` 的 `suppressions`）。**請勿刪除 `emails/state/`。**
- `emails/secrets/`、`emails/state/` 不可 commit。

## 七、檔案位置

| 位置 | 內容 |
|---|---|
| `emails/config.json` | 設定（無密碼） |
| `emails/secrets/client_secret.json`、`token.json` | Google OAuth（不可 commit） |
| `emails/state/outreach.db` | 狀態資料庫（SQLite） |
| `emails/state/logs/YYYY-MM-DD.log` | 每日日誌；`launchd.out.log`、`launchd.err.log` 為排程輸出 |
| `emails/state/outbox/` | dry-run 預覽 |
| `emails/state/report.html` | 狀態報告 |
| `emails/scripts/` | 所有可執行指令（setup、start、stops/stop、status、run、preview-sequence.py） |
| `emails/pipeline/` | 程式（Node.js）；`npm test` 執行測試 |

## 八、疑難排解

| 問題 | 處理 |
|---|---|
| `setup.sh` 說找不到 `client_secret.json` | 按第一部分下載，放到 `emails/secrets/client_secret.json` |
| 瀏覽器顯示「存取權遭拒」或「應用程式未經驗證」 | 確認以 antapp.ai 帳戶登入，及 OAuth 同意畫面設為「內部」 |
| 日誌出現 `AUTH:` 或 `invalid_grant` | token 失效（例如更改密碼或撤銷權限）。刪除 `emails/secrets/token.json` 後再執行 `./emails/scripts/setup.sh` |
| `Logged in as … but config.sender.email is …` | 登入了錯的帳戶；刪除 `token.json` 後重新執行 `setup.sh` |
| `claude -p failed` / Claude 逾時 | 在終端機執行 `claude` 確認已登入；跟進電郵失敗的學校會標記 `error`，修正後執行 `./emails/scripts/run.sh --retry-errors` |
| 排程沒有執行 | `./emails/scripts/status.sh` 查看是否「已載入」；查看 `emails/state/logs/launchd.err.log`；確認 Mac 沒有登出。再執行 `./emails/scripts/start.sh` |
| 排程找不到 node 或 claude | 安裝位置改變後再執行 `./emails/scripts/start.sh`（它會重新偵測並寫入 PATH） |
| `another run is in progress` | 另一次執行仍在進行；如確定沒有，刪除 `emails/state/run.lock` |
| 很多學校變成 `error` | 查看 `status.sh` 的錯誤原因或當日日誌；修正後 `./emails/scripts/run.sh --retry-errors` |
| 想先看看會寄甚麼 | `./emails/scripts/run.sh --dry-run`，打開 `emails/state/outbox/*.html` |
| Gmail API 429／5xx | 程式會自動以指數退避重試；持續出現可調低 `maxPerRun`／`maxPerDay` |

---

## 附錄：手動範本（舊工具）

| 檔案 | 用途 |
|---|---|
| `school-outreach.md` | 原始推廣電郵範本。第一行「主旨：」為電郵主旨；`**文字**` 為粗體；`![Ant-App](網址)` 為圖片（公司圖示，放在聲明之上） |
| `ant_app_icon.png` | 公司圖示原檔。電郵使用網上版本 https://www.antapp.ai/img/ant_app_icon.png |

單封手動發送（經 Chrome 的 Gmail 網頁）：

```sh
cd _build/mailer
./open-chrome.sh            # 第一次需在開啟的 Chrome 登入 Gmail
node send.mjs --to principal@school.edu.hk --name 陳校長 --school 葵涌循道中學
```

資助金額及期限以教育局最新通函為準，發送前請再核對。
