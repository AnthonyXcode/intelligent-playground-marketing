import { benefits, moreFeatures } from '../content'

export default function MoreFeatures() {
  return (
    <section className="sec more" id="more" aria-labelledby="more-title">
      <div className="wrap">
        <div className="sec-head">
          <h2 id="more-title">更多功能</h2>
          <p>由挑戰設計到家長通知，配合學校推行體育活動。</p>
        </div>
        <ul className="more-grid">
          {moreFeatures.map((f) => (
            <li key={f.title}><h3>{f.title}</h3><p>{f.text}</p></li>
          ))}
        </ul>
        <div className="benefits">
          <h3>智能運動場的好處</h3>
          <ul>
            {benefits.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </div>
      </div>
    </section>
  )
}
