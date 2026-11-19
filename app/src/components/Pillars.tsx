export default function Pillars() {
  return (
    <section className="sec pillars" id="features" aria-labelledby="features-title">
      <div className="wrap">
        <div className="sec-head">
          <h2 id="features-title">一部 AI 運動站，校園隨時郁</h2>
          <p>大屏加鏡頭，放在走廊、禮堂或有蓋操場。學生站在鏡頭前就可以開始，成績自動記錄到後台。</p>
        </div>
        <div className="pillar-grid">
          <article className="pillar">
            <div className="glyph"><img src="assets/icons/icon-jumping-jacks.png" alt="" /></div>
            <h3>好玩、自發</h3>
            <span className="en" lang="en">Fun &amp; self-started</span>
            <p>最多 3 人同場競賽，設有排行榜、遊戲化項目和挑戰，小息也能動起來。</p>
          </article>
          <article className="pillar">
            <div className="glyph"><img src="assets/icons/icon-squat.png" alt="" /></div>
            <h3>AI 即時計數</h3>
            <span className="en" lang="en">AI that counts</span>
            <p>裝置上的 AI 姿勢偵測即時數算次數，並有卡通示範動畫教正確動作。</p>
          </article>
          <article className="pillar">
            <div className="glyph"><svg viewBox="0 0 34 34" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M5 29h24" /><path d="M9 24v-6M15 24V10M21 24v-9M27 24V6" /></svg></div>
            <h3>數據看得見</h3>
            <span className="en" lang="en">Data teachers can use</span>
            <p>成績按年級、班別、學號記錄。教師後台可查看參與率、運動時間和使用時段。</p>
          </article>
        </div>
        <PrivacyNote />
      </div>
    </section>
  )
}

function PrivacyNote() {
  return (
    <div className="privacy" id="privacy">
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" aria-hidden="true"><path d="M20 4 6 9v10c0 9 6 15 14 17 8-2 14-8 14-17V9L20 4Z" /><path d="m14 20 4.5 4.5L27 16" strokeLinecap="round" /></svg>
      <div>
        <h3>AI 在裝置上運算，不上載影片</h3>
        <p>姿勢及臉部偵測在運動站本機運算，不會上載影片。上載到學校後台的只有成績紀錄及一張頭像縮圖，學校可在管理員設定中開關資料傳送，設定受管理員密碼保護。</p>
      </div>
    </div>
  )
}
