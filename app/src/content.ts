export const CONTACT_EMAIL = 'anthonychan@antapp.ai'

export type ExerciseSvg = 'plank' | 'swim' | 'dribble'
export interface Exercise {
  name: string
  icon?: string
  svg?: ExerciseSvg
  game?: boolean
  tag?: string
}

export const exercises: Exercise[] = [
  { name: '深蹲', icon: 'assets/icons/icon-squat.png' },
  { name: '俯臥撐', icon: 'assets/icons/icon-push-up.png' },
  { name: '仰臥起坐', icon: 'assets/icons/icon-sit-up.png' },
  { name: '平板支撐', svg: 'plank' },
  { name: '開合跳', icon: 'assets/icons/icon-jumping-jacks.png' },
  { name: '高抬腿', icon: 'assets/icons/icon-high-knees.png' },
  { name: '臀橋', icon: 'assets/icons/icon-glute-bridge.png' },
  { name: '仰臥抬腿', icon: 'assets/icons/icon-lying-leg-raise.png' },
  { name: '左右跳', icon: 'assets/icons/icon-left-right-jump.png' },
  { name: '百米飛人', icon: 'assets/icons/icon-run.png', game: true, tag: '遊戲' },
  { name: '游泳健將', svg: 'swim', game: true, tag: '遊戲' },
  { name: '運球高手', svg: 'dribble', game: true, tag: 'Beta' },
]

export interface Mode { title: string; en: string; text: string }
export const modes: Mode[] = [
  { title: '單人練習', en: 'Single practice', text: '一次一人，按自己步伐練習指定項目。' },
  { title: '多人競賽', en: 'Multiplayer', text: '最多 3 人同場比賽，即時比分，完成後有成績動畫。' },
  { title: '隨機練習', en: 'Random practice', text: '由系統隨機安排項目，挑戰不同動作。' },
]

export interface Feature { title: string; text: string }
export const moreFeatures: Feature[] = [
  { title: '有趣的挑戰', text: '按年齡、能力及體能目標自訂挑戰，例如「一分鐘內誰跳得最多」或限時深蹲。完成挑戰可獲得徽章和獎勵。' },
  { title: '社交互動', text: '團隊合作挑戰，培養團隊精神、體育精神及溝通能力。學生亦可在社交媒體分享成就。' },
  { title: '即時反饋', text: '運動時即時顯示重複次數及持續時間，幫助學生改善動作。' },
  { title: '家長訂閱資料', text: '家長或獲授權監護人可訂閱子女的運動進度，以手機短訊接收通知，無須下載第三方軟件。' },
  { title: '定制化支援', text: '我們與學校或機構合作，按需要設計課程、挑戰模式及活動內容。' },
  { title: '簡單易用', text: '介面簡單直觀，設定快捷，學生和老師只需很少培訓就可以使用。' },
]

export const benefits: string[] = [
  '以科技吸引學生，令運動更有吸引力',
  '應對兒童肥胖及久坐的生活方式',
  '培養成長心態',
  '提升自信心和自尊感',
]

export interface Funding {
  name: string
  circular: string
  deadline?: string
  amount: string
  amountNote: string
  eligible: string
  text: string
}
export const funding: Funding[] = [
  {
    name: 'MVPA60 一筆過津貼',
    circular: '教育局通函第 73/2024 號',
    deadline: '須於 2027-08-31 前用完',
    amount: '$150,000',
    amountNote: '每校',
    eligible: '公營及直資中小學、特殊學校',
    text: '津貼用途明列體育相關資訊科技服務、流動應用程式及軟件，以及體育活動套件和輔助工具。運動站屬體育專用設備。',
  },
  {
    name: '「智」啟學教撥款',
    circular: '教育局通函第 221/2025 號',
    amount: '$500,000',
    amountNote: '每校，可用至 2028-08-31',
    eligible: '已獲批學校',
    text: '學校須在至少 3 個科目推行 AI 輔助教學，體育可作其中一科。',
  },
  {
    name: 'QEF 專項撥款',
    circular: '教育局通函第 96/2026 號',
    amount: '$3,000,000',
    amountNote: '累計上限',
    eligible: '公帑資助學校',
    text: '第十七期：2026 年 10 月至 2027 年 1 月接受申請。',
  },
]

export const rolloutSteps: string[] = [
  '到校示範及場地評估',
  '報價及配合資助申請',
  '安裝及設定年級、班別',
  '教師簡介及學生試玩',
  '定期檢視數據報告',
]

export interface Faq { q: string; a: string }
export const faqs: Faq[] = [
  { q: '需要學生帶手機或戴手環嗎？', a: '不需要。學生只要站在鏡頭前舉手，就可以加入。' },
  { q: '一次可以幾多人玩？', a: '單人練習一次一人；多人競賽最多 3 人同場比賽。' },
  { q: '會唔會拍片上載？學生私隱點保障？', a: '姿勢和臉部偵測都在裝置上運算，不會上載影片。如學校開啟資料傳送，系統只會上載成績紀錄（項目、次數、時間、年級、班別、學號）及一張頭像縮圖到學校後台。學校可在管理員設定中關閉資料傳送。' },
  { q: '可以幫學校記錄 MVPA60 嗎？', a: '運動站會記錄每位學生的運動次數和時間，後台可統計人均和每位學生的運動時數，協助學校推動 MVPA60。' },
  { q: '需要什麼硬件？', a: '標準配置是大屏 AI 運動站配 1080p USB 鏡頭，也可使用 iPad 版本。我們會按場地建議擺放位置。' },
  { q: '價錢多少？可以用什麼資助？', a: '我們按學校的場地及需要報價。MVPA60 一筆過津貼、「智」啟學教撥款及 QEF 專項撥款都是常用的資助來源，我們可以協助準備申請文件。' },
]

/** Funding checkboxes on the demo form: value is what goes into the e-mail. */
export const fundOptions: { value: string; label: string }[] = [
  { value: 'MVPA60', label: 'MVPA60 一筆過津貼' },
  { value: 'AI', label: '「智」啟學教撥款' },
  { value: 'QEF', label: 'QEF 專項撥款' },
]
