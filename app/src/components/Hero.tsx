export default function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="wrap">
        <div>
          <h1 id="hero-title"><span className="line">將運動變成</span><span className="line">有趣的學習體驗</span></h1>
          <p className="lede">Intelligent Playground 智能運動場是一部放在學校及康樂中心的 AI 運動站。系統利用動作偵測即時追蹤及分析學生的動作，幫助學生每日郁足 <span className="count">60</span> 分鐘中等至高強度體育活動（MVPA60），成績自動記錄到教師後台。</p>
          <p className="en-sub" lang="en">Turning exercise into a fun learning experience. AI-powered exercise kiosk for schools and leisure centres.</p>
          <div className="ctas">
            <a className="btn btn-tape" href="#contact">預約到校示範</a>
            <a className="btn btn-ghost" href="#funding">了解資助方案</a>
          </div>
          <ul className="hero-facts">
            <li>毋須手機或手環</li>
            <li>最多 3 人同場比賽</li>
            <li>12 個運動項目</li>
          </ul>
        </div>
      </div>
    </section>
  )
}
