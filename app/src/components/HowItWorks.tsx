const steps = [
  { img: 'assets/students-raise-hand-to-join.jpg', alt: '學生站在大屏前舉起手，準備加入遊戲', w: 1920, h: 1440, title: '站入框內', text: '鏡頭畫面上有站位框，學生走到框內就可以。' },
  { img: 'assets/app-raise-hand-to-join.jpg', alt: '加入畫面：兩個綠色「已加入」位置，第三個位置等待參加者，上方顯示倒數', w: 1920, h: 886, title: '加入', text: '站在鏡頭前，按提示即可加入，最多 3 人。' },
  { img: 'assets/app-competition-timer.jpg', alt: '深蹲比賽畫面：鏡頭影像上有站位框，下方是 60 秒倒數和各參加者的計數', w: 1920, h: 886, title: '開始運動', text: '跟著示範做，AI 自動計數；完成後輸入班別學號，成績即時記錄。' },
]

export default function HowItWorks() {
  return (
    <section className="sec how" id="how" aria-labelledby="how-title">
      <div className="wrap">
        <div className="sec-head">
          <h2 id="how-title">三步開始</h2>
          <span className="en" lang="en">Step in, raise a hand, move.</span>
        </div>
        <ol className="lane">
          {steps.map((s, i) => (
            <li key={s.title}>
              <div className="shot"><img src={s.img} alt={s.alt} loading="lazy" width={s.w} height={s.h} /></div>
              <div className="num"><b>{i + 1}</b></div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
