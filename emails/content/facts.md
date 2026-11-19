# 智能運動場 — 已核實事實表（AI 只可使用以下事實）

> 版本：2026-11-19。格式：`- F-ID [適用級別] 事實（來源）`。級別：KG 幼稚園、PRI 小學、SEC 中學、SPE 特殊學校。
> 每行一項事實；pipeline 可按級別篩選（行內 `[...]` 含該級別即適用）。
> 資助資料以教育局最新通函為準。

## 寫作規則（必須遵守）

- 只可使用本表事實。不可自行加入數字、日期、客戶、學校名稱、獎項、用家評價、媒體報道或研究數據。
- 不寫價錢，一律「按學校需要報價」。不寫「免費」示範。
- 不提背後技術或供應商名稱（例如 Google、ML Kit、MediaPipe、RK3588、Android、Flutter、Strapi）。只用「AI 姿勢偵測」「在運動站本機運算」等一般描述。
- 不可提及未核實功能：徽章／獎勵、社交媒體分享、團隊合作挑戰、家長短訊訂閱。
- MVPA60：只可寫「記錄運動次數和時間，協助學校推動 MVPA60」，不可寫「自動產生／匯出教育局 MVPA60 報表」。
- 私隱：不可寫「影像永不離開裝置」或「完全不收集相片」。
- 「運球高手」必須標示 Beta，只限單人，須使用籃球。
- 幼稚園（KG）：不可提 MVPA60 一筆過津貼、「智」啟學教撥款、升中派位、全方位學習津貼、QEF $3,000,000 上限。
- 特殊學校（SPE）：不可作任何醫學、治療或康復成效聲稱。
- 不可提 Robocoach 或其他產品的資料。

## 產品

- F-PRODUCT [KG,PRI,SEC,SPE] 「智能運動場 Intelligent Playground」是一部放在校園的 AI 運動站，配合網上教師數據後台；由 Ant-App Limited 提供。（emails/school-outreach.md；_build/content.md §1）
- F-HOW-AI [KG,PRI,SEC,SPE] 系統利用動作偵測即時追蹤學生動作，AI 即時計算次數，成績自動記錄到教師後台。（emails/school-outreach.md）
- F-STEPS [KG,PRI,SEC,SPE] 三步開始：① 站入鏡頭畫面上的站位框 ② 舉手加入（最多 3 人）③ 跟示範做，AI 自動計數；完成後輸入年級、班別、學號，成績即時記錄。（index.html「三步開始」；_build/content.md §3.3）
- F-NO-DEVICE [KG,PRI,SEC,SPE] 學生毋須手機或手環，只要站在鏡頭前舉手就可以加入。（app/src/content.ts faqs；index.html）
- F-ANYTIME [KG,PRI,SEC,SPE] 學生可在小息、午膳或課後主動運動；設計上老師毋須在場逐一督導。（emails/school-outreach.md；_build/content.md §1 三大價值支柱）
- F-EX-COUNT [KG,PRI,SEC,SPE] 共 12 個運動項目：9 項體適能＋3 項遊戲化。項目會持續更新。（index.html；app/src/content.ts exercises）
- F-EX-FITNESS [KG,PRI,SEC,SPE] 體適能 9 項：深蹲、俯臥撐（掌上壓）、仰臥起坐、平板支撐、開合跳、高抬腿、臀橋、仰臥抬腿、左右跳。（app/src/content.ts exercises）
- F-EX-GAMES [KG,PRI,SEC,SPE] 遊戲化 3 項：「百米飛人」「游泳健將」，以及「運球高手」（Beta）。（app/src/content.ts exercises）
- F-DRIBBLE [PRI,SEC,SPE] 「運球高手」（Beta）：單人 60 秒運球挑戰，設簡單、中等、困難三個難度；AI 偵測籃球，分開計算左右手運球；困難級要一邊運球一邊觸碰屏幕上的星星；須使用籃球；只限單人，不適用於多人競賽及隨機練習。（index.html；_build/content.md 更新 2026-11-19）
- F-MODES [KG,PRI,SEC,SPE] 三種玩法：單人練習（一次一人，按自己步伐練習）、多人競賽（最多 3 人同場比賽，即時比分，完成後有成績動畫）、隨機練習（系統隨機安排項目）。（app/src/content.ts modes）
- F-DEMO-ANIM [KG,PRI,SEC,SPE] 每個項目都有卡通示範動畫，提醒學生正確動作。（index.html；_build/content.md F7）
- F-REALTIME [KG,PRI,SEC,SPE] 運動時即時顯示重複次數及持續時間，幫助學生改善動作。（app/src/content.ts moreFeatures「即時反饋」）
- F-LEADERBOARD [PRI,SEC,SPE] 每個項目設有首十名排行榜。（index.html；_build/content.md F9）
- F-CHALLENGE [KG,PRI,SEC,SPE] 可按年齡及能力自訂挑戰，例如「一分鐘內誰跳得最多」或限時深蹲。（emails/school-outreach.md；app/src/content.ts；注意：不可提徽章或獎勵）
- F-CUSTOM [KG,PRI,SEC,SPE] 定制化支援：我們與學校合作，按需要設計課程、挑戰模式及活動內容。（app/src/content.ts moreFeatures「定制化支援」）
- F-EASY [KG,PRI,SEC,SPE] 介面簡單直觀，設定快捷，學生和老師只需很少培訓就可以使用。（app/src/content.ts moreFeatures「簡單易用」）
- F-BENEFITS [KG,PRI,SEC,SPE] 好處：以科技吸引學生，令運動更有吸引力；應對久坐的生活方式；培養成長心態；提升自信心。（app/src/content.ts benefits；不可延伸為醫學或療效聲稱）

## 教師數據後台

- F-DASH-RECORD [KG,PRI,SEC,SPE] 成績按年級、班別、學號記錄，包括項目、次數及運動時間。（_build/content.md F8）
- F-DASH-FEATURES [KG,PRI,SEC,SPE] 教師後台可查看：各年級、班級及學生的參與情況；人均運動時間及每位學生的總運動時間；使用時段及星期分佈；最受歡迎的項目及模式；班級排行及最活躍學生；一鍵列印報告。（index.html「教師數據後台」；_build/content.md F16）
- F-DASH-MOBILE [KG,PRI,SEC,SPE] 網上後台，電腦和手機都可查看。（index.html）
- F-DASH-MVPA60 [PRI,SEC,SPE] 運動站記錄每位學生的運動次數和時間，後台可統計人均和每位學生的運動時數，協助學校推動 MVPA60。（app/src/content.ts faqs）

## 私隱

- F-PRIVACY-ONDEVICE [KG,PRI,SEC,SPE] 姿勢及臉部偵測在運動站本機運算，不會上載影片。（index.html；app/src/content.ts faqs）
- F-PRIVACY-UPLOAD [KG,PRI,SEC,SPE] 如學校開啟資料傳送，只會上載成績紀錄（項目、次數、時間、年級、班別、學號）及一張頭像縮圖到學校後台；學校可在管理員設定中關閉資料傳送，設定受管理員密碼保護。（app/src/content.ts faqs；index.html）

## 部署及場地

- F-DEPLOY-OPTIONS [KG,PRI,SEC,SPE] 可選落地式運動站、壁掛大屏或 iPad 版本；標準配置是大屏 AI 運動站配 1080p USB 鏡頭。（index.html「安裝簡單」；app/src/content.ts faqs）
- F-DEPLOY-PLACES [KG,PRI,SEC,SPE] 適合放在走廊、禮堂或有蓋操場；我們會按場地建議擺放位置。（index.html；app/src/content.ts faqs）
- F-DEPLOY-SETTINGS [KG,PRI,SEC,SPE] 年級及班別可在管理員設定中按學校情況調整，亦可顯示學校標誌及校名。（index.html）
- F-ROLLOUT [KG,PRI,SEC,SPE] 推行步驟：到校示範及場地評估 → 報價及配合資助申請 → 安裝及設定年級、班別 → 教師簡介及學生試玩 → 定期檢視數據報告。（app/src/content.ts rolloutSteps；不可寫所需日數）

## 合作及行動

- F-DEMO [KG,PRI,SEC,SPE] 歡迎預約到校示範，讓學生親身試玩。（emails/school-outreach.md；不可寫「免費」）
- F-QUOTE [KG,PRI,SEC,SPE] 按學校場地、需要及資助情況提供報價。（emails/school-outreach.md；_build/content.md §0）
- F-GRANT-HELP [KG,PRI,SEC,SPE] 我們可協助學校準備資助申請文件及配合採購程序。（emails/school-outreach.md；app/src/content.ts faqs）
- F-AI-LESSON-KIT [PRI,SEC,SPE] 我們可提供 AI＋體育教案及公開課配套。（emails/school-outreach.md）
- F-WEBSITE [KG,PRI,SEC,SPE] 了解更多：https://www.intelligent-playground.com/（emails/school-outreach.md）

## 政策

- F-WHO60 [PRI,SEC,SPE] 世界衞生組織建議 5–17 歲兒童及青少年每天平均累積最少 60 分鐘中等至劇烈強度體能活動（MVPA60）。（index.html；_build/content.md F1）
- F-ASAP [PRI,SEC,SPE] 教育局推行「躍動校園 活力人生」計劃及「MVPA60 獎勵計劃」，推動學生每天累積 60 分鐘體能活動。（_build/content.md F1；funding/primary.md §2）
- F-PE-SCORE [PRI] 教育局優化中學學位分配「校內成績評估」安排：體育比重由 0 增至 2，由 2026/27 學年小五下學期起實施。（index.html；_build/content.md F2）
- F-GAP [KG,PRI,SEC,SPE] 常見難題：體育課時有限；小息、午飯時間多數靜坐；老師難以逐一督導；活動量欠缺數據記錄。（index.html；_build/content.md Slide 2）

## 資助：中小學及特殊學校

- F-MVPA60-AMOUNT [PRI,SEC,SPE] 「支援學校推動校園體育氛圍及『MVPA60』一筆過津貼」（教育局通函第 73/2024 號）：每校 $150,000，已於 2024 年 3 月發放，學校毋須申請。（funding/primary.md §2；funding/special.md §1）
- F-MVPA60-DEADLINE [PRI,SEC,SPE] MVPA60 一筆過津貼須於 2027 年 8 月 31 日前用完；資助學校的餘款須退還。（funding/primary.md §2；funding/secondary.md §1）
- F-MVPA60-SCOPE [PRI,SEC,SPE] 津貼用途明列「與體育／運動相關的資訊科技服務、流動應用程式和相關軟件，以及體育活動套件和輔助工具」及「購置或改善學校的體育／運動器材」；不可用於一般用途的電子器材，運動站屬體育專用設備。（教育局通函第 73/2024 號；funding/primary.md §2）
- F-MVPA60-ELIGIBLE [PRI,SEC,SPE] 適用於所有公營學校（官立、資助、按位津貼、特殊學校）及直資學校；幼稚園不適用。如學校仍有餘款即可運用。（funding/primary.md §2；funding/special.md §1）
- F-AIEDU-AMOUNT [PRI,SEC,SPE] 「『智』啟學教」撥款計劃（教育局通函第 221/2025 號）：每校一筆過 $500,000，可使用至 2028 年 8 月 31 日；適用於已獲撥款的公帑資助中小學及特殊學校。（funding/primary.md §1；funding/special.md §2）
- F-AIEDU-SUBJECTS [PRI,SEC,SPE] 學校須在至少 3 個科目推行 AI 輔助教學（每科最少 2 個級別），並發展 6 個教學示例、舉行 3 次公開課及 3 次經驗分享；體育可以是其中一科。（funding/primary.md §1）
- F-AIEDU-SCOPE [PRI,SEC,SPE] 撥款可用於購置、訂閱或租用推動 AI 輔助教學的軟件、硬件及平台；不可用於教師培訓。（funding/primary.md §1；funding/special.md §2）
- F-SPE-AIEDU-ALL [SPE] 教育局通告第 11/2026 號指所有公帑資助學校均已參加「智」啟學教，撥款已於 2026 年 6 月發放。（funding/special.md §2）
- F-QEF-DFP [PRI,SEC,SPE] 優質教育基金「公帑資助學校專項撥款計劃」（教育局通函第 96/2026 號）：每校累計申請額上限 $3,000,000，可用於校本課程及相關物資購置；第十七期申請期為 2026 年 10 月至 2027 年 1 月。（funding/primary.md §3）
- F-QEF-PLEDGE [PRI,SEC,SPE] QEF「我的行動承諾」加強版（第二階段）：每校一個不超過 $300,000 的申請，範疇包括「促進學生身心健康」，全年接受申請至 2027/28 學年底。（funding/primary.md §4；funding/secondary.md §5）
- F-LWL [PRI,SEC,SPE] 「全方位學習及姊妹學校津貼」可用於課室以外的全方位學習活動，包括購置活動所需的設備、流動應用程式或軟件（全年此類開支不超過該津貼的 15%），範疇包括體藝發展及數字教育、AI、STEAM；須與活動掛鈎，例如小息或課後 AI 運動挑戰、校隊體能訓練。（funding/secondary.md §4；funding/special.md §3）
- F-LWL-SEC-RATE [SEC] 2026/27 學年中學全方位學習部分為每名學生 $1,350。（funding/secondary.md §4）

## 資助：幼稚園

- F-KG-UNIT [KG] 幼稚園教育計劃「單位資助」（教育局通函第 1/2026 號附錄 3）可用於「供學校使用作為教學用途的家具及設備」及「與教學活動有直接關係的其他支出」；屬經常性資助，毋須另行申請，學校自行在預算中編配；須依照《幼稚園採購程序指引》採購。（funding/kindergarten.md §1）
- F-KG-QEF [KG] QEF 專項撥款新階段（教育局通函第 96/2026 號）：每所幼稚園累計申請額由 $500,000 提高至 $700,000，可用於校本課程及相關物資購置；第十七期申請期為 2026 年 10 月至 2027 年 1 月，第十八期為 2027 年 4 月至 7 月。（funding/kindergarten.md §2）
- F-KG-PLEDGE [KG] QEF「我的行動承諾」加強版（第二階段）：每所幼稚園可提交一個不超過 $150,000 的申請，範疇包括「促進學生的身心健康」，全年接受申請至 2027/28 學年底。（funding/kindergarten.md §3）
- F-KG-NOT-ELIGIBLE [KG] （內部用，勿在電郵提及）MVPA60 一筆過津貼及「智」啟學教撥款不適用於幼稚園。（funding/kindergarten.md §二）
