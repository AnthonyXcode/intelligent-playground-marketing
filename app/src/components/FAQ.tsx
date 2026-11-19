import { faqs } from '../content'

export default function FAQ() {
  return (
    <section className="sec dash-sec" id="faq" aria-labelledby="faq-title">
      <div className="wrap">
        <div className="sec-head"><h2 id="faq-title">常見問題</h2></div>
        <div className="faq-list">
          {faqs.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <div className="a"><p>{f.a}</p></div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
