# 獨立審查：學校電郵推廣 pipeline（2026-11-19）

範圍：`SPEC.md`、`README.md`、`config.json`、`scripts/*`、`pipeline/src|test`、`content/*`、`data/schools.csv`。
審查前有 48 個測試，現有 57 個，全部通過（`cd emails/pipeline && npm test`）。我沒有寄出任何電郵、沒有安裝 launchd，也沒有 commit。

## 已修正的阻斷問題

| # | 問題 | 修正 |
|---|---|---|
| 1 | **回覆分類失敗後仍會寄出**：Claude 分類失敗只會 `continue`，學校仍是 `active`，同一次 run 就會再寄跟進（對方可能已要求取消訂閱）。 | 學校改為 `error`（`reply not classified …`），本次不寄。該郵件不標為已見，下次 run 會重新分類；如結果是 `auto_reply`，自動恢復 `active`。（`replies.mjs`） |
| 2 | **Gmail 讀取失敗後仍會寄出**：讀取電郵串或搜尋失敗時，仍照常跟進受影響的學校。 | `checkReplies` 回傳 `hold`，列出受影響的學校；`sendDue` 本次跳過這些學校。（`replies.mjs`、`runner.mjs`、`sender.mjs`） |
| 3 | **兩次檢查之間的回覆**：一次 run 可長達數小時，期間收到的回覆不會阻止跟進。 | 每封跟進寄出前重新讀取該電郵串；如有未分類的來信就跳過，下次先分類。 |
| 4 | **共用或免費網域的學校收不到新串回覆**：網域搜尋會略過 gmail、yahoo、edb.gov.hk（45 間）及辦學團體共用網域（東華 34、保良局 31 等）；學校用原地址開新電郵串回覆（包括「取消訂閱」）就偵測不到。 | 另外以學校的完整電郵地址搜尋 `from:(addr OR …)`。 |
| 5 | **PDPO：個人／免費／校長郵箱**：沒有任何過濾。 | `notes` 含「免費郵箱／可能為個人電郵／校長郵箱」的行預設設為 `skipped_flagged`，共 **85 間有電郵**（共 89 行有此標記，不是 80）。`config.includeFlaggedContacts: true` 才會包括；改回 `false` 再匯入即再次停止。 |
| 6 | 重複電郵 | 現時資料沒有重複。匯入時同一電郵只保留第一行，其餘行改為 `skipped_no_email`。取消訂閱的檢查用原本的電郵地址，所以以新 id 出現仍然擋住。 |
| 7 | **Lock 會被搶**：超過 6 小時的 lock，即使該 run 仍在執行，也會被當作失效刪除，造成兩次 run 重複寄出。 | 只有 pid 已不存在，或 lock 早於上次開機（pid 被重用），才當作失效。 |
| 8 | 機器上的 Claude 設定會滲入 | `claude -p` 會讀取該 Mac 使用者的 CLAUDE.md 及 hooks（已實測：會讀到本機的 RTK 指示）。現加上 `--setting-sources=`（實測後已不會讀到）。`setup.sh` 及 `preview-sequence.py` 亦已更新。 |
| 9 | Kill switch | `config.json` 讀取失敗（例如修改到一半）時，原本會繼續寄；現改為停止。等候後、寄出前再檢查一次 `enabled`。 |
| 10 | KG 用語只靠 prompt 約束 | 新增 `bannedTermsByLevel.KG`（MVPA60、「智」啟學教、升中、全方位學習），程式寄出前會檢查。`F-KG-NOT-ELIGIBLE` 改標為 `[INTERNAL]`，不再傳給 AI（原本 KG 的 prompt 會收到這一行，內含 MVPA60 字眼）。 |
| 11 | 內容 | SPE 主旨原本是「舉手就可以開始運動」，強調了舉手，已改為「站在鏡頭前就可以開始運動」。KG 及 SPE 正文、`recess-lunch` 及 `spe-inclusive` 主題的 angle 亦已拿走「舉手即可加入」。PRI 及 SEC 首封提及「運球高手」時，原本沒有寫「只限單人，須使用籃球」（違反 facts.md 規則），已補上。 |
| 12 | 腳本 | `stop.sh` 原本是複本，現已改為指向 `stops.sh` 的 symlink。`start.sh` 在 bootout 後重試 bootstrap（避免 error 5）。`setup.sh` 把 `state/` 設為 chmod 700。 |

## 已核對，無問題

- **選校**：follow-up 先寄，再寄首封（PRI、SEC、SPE、KG，再按地區）；10 封上限；`minDaysBetween` 按香港日曆日計算；`maxPerRun`／`maxPerDay`／隨機延遲；testRecipient 改寄測試地址、主旨加【測試】，並受 `testMaxPerRun` 限制。
- **Dry-run**：不建立 Gmail client，亦不改學校狀態。
- **收結主題**：`final-close` 固定用於第 10 封。prompt 及 angle 都禁止說「最後一封」；實際生成的內容亦沒有這樣說。
- **Threading 及 MIME**：threadId、In-Reply-To（上一封）、References（全部）、主旨 `Re:`。主旨用 RFC 2047 B 編碼並按字元切分；正文為 base64 `multipart/alternative`。簽名由程式加上；AI 正文如含簽名或 NOTICE 會被拒寄。
- **回覆處理**：`auto_reply` 不會停止寄送；mailer-daemon 退信在呼叫 Claude 前已判定，不經 Claude。取消訂閱寫入 `suppressions`，重新匯入及 reactivate 後仍然有效。
- **分類輸出驗證**：只接受 7 個類別；`stop` 由程式決定，不用模型的值。模型輸出不能觸發其他動作（沒有工具，Node 負責所有 I/O）。summary 在 report.html 已 escape。
- **跟進 prompt**：歷史內容只取自我們寄出的 `body_text`，不含來信內容。
- **Secrets**：token 及 client secret 權限 600，secrets 目錄 700，並已 gitignore。`git ls-files` 沒有 secrets、state、token 或金鑰。report.html 只在本機，不含學校電郵或 token。
- **npm**：只用公開 registry；版本已鎖定（googleapis 189.0.0，2026-10-30 發佈）。
- **腳本**：`bash -n` 全部通過；腳本使用絕對路徑，從任何目錄執行都可以；launchd PATH 寫入 node 及 claude 的位置；如本機時區不是香港，會換算成本機時間。

## Dry-run 結果

在 scratchpad 複製一份環境，用真實的 `schools.csv` 及 content，`maxPerRun=5`，真實 Claude 共呼叫 2 次。

- 匯入 2086 行：505 行沒有電郵，85 行 `skipped_flagged`，1496 間 `pending`。
- 第一次 run：5 封 PRI 首封。
- 第二次 run（預先在 DB 放入狀態）：KG、SEC、SPE 首封各 1 封，PRI 第 2 封（`mvpa60-deadline`），KG 第 10 封（`final-close`）。
- 檢查結果：標頭、編碼、簽名及取消訂閱字句全部正確。KG 兩封都沒有 MVPA60、「智」啟學教或升中，五封都沒有技術名詞，也沒有「免費」。

## 尚餘風險

- **Prompt injection／誤判**：來信可誘使模型判為 `auto_reply`，令跟進繼續寄出（上限仍是 10 封）。程式無法完全防止，建議定期在 report 抽查 `auto_reply`。
- **回覆後再要求取消訂閱**：已回覆（`replied`）的學校不再監察。如對方之後才說取消訂閱，系統不會知道；這時用 `--reactivate --include-replied` 就可能再寄給他們。
- **共用網域的老師個人地址**：老師用自己的地址（同屬辦學團體網域）開新電郵串回覆，仍無法對應到學校。直接回覆原電郵串則可以偵測。
- **送達率及帳戶風險**：新域名大量發出冷郵件，有被 Workspace 暫停的風險。只有 mailto 形式的 `List-Unsubscribe`，沒有 one-click（`List-Unsubscribe-Post`）。
- **Lock 沒有逾時**：run 如卡死，lock 不會自動移除，之後的 run 都會被擋（`status.sh` 會顯示）。這是刻意取捨，避免重複寄出。
- **launchd 下的 Claude**：需要 Mac 保持登入，Claude CLI 才能讀取 keychain 憑證。

## 需要你決定

1. **Public repo 個人資料**：`data/schools.csv` 已公開了校長姓名，以及 85 個可能屬於個人的電郵（例如 gmail、yahoo、`principal@…`）。建議從 commit 的 CSV 刪去這些電郵；如有需要，再清理 git 歷史。
2. **是否寄往這 85 間**：預設不寄。要寄就把 `includeFlaggedContacts` 改為 `true`。
3. **起步寄送量**：建議首兩週把 `maxPerRun` 及 `maxPerDay` 降至約 30–50，同時確認 antapp.ai 的 SPF、DKIM 及 DMARC 已設定。
4. **已回覆學校是否繼續監察取消訂閱**：要監察，每封後續來信都要呼叫 Claude 分類；不監察，就要在 `--include-replied` 前人手核對。
