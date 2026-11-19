import { funding, rolloutSteps } from '../content'

export default function Funding() {
  return (
    <section className="sec" id="funding" aria-labelledby="fund-title">
      <div className="wrap">
        <div className="sec-head">
          <h2 id="fund-title">可用資助</h2>
          <p>多項教育局及優質教育基金資助都可涵蓋 AI 體育設備及軟件。價錢按學校需要報價，我們可以協助準備申請文件。</p>
        </div>
        <ul className="fund-list">
          {funding.map((f) => (
            <li className="fund" key={f.name}>
              <div><h3>{f.name}</h3><span className="circ">{f.circular}</span>{f.deadline && <span className="deadline">{f.deadline}</span>}</div>
              <dl><dt>金額</dt><dd className="amt">{f.amount}</dd><dd>{f.amountNote}</dd></dl>
              <dl><dt>適用</dt><dd>{f.eligible}</dd></dl>
              <p>{f.text}</p>
            </li>
          ))}
        </ul>
        <div className="fund-notes">
          <p>幼稚園：可考慮單位資助或 QEF 專項撥款（MVPA60 津貼及「智」啟學教撥款不適用於幼稚園）。</p>
          <p className="official">以教育局最新通函為準。資助的使用亦須符合 QEF 最新指引及學校採購程序。</p>
        </div>

        <h3 className="steps-title">由試用到全校使用</h3>
        <ol className="steps">
          {rolloutSteps.map((s) => <li key={s}>{s}</li>)}
        </ol>
      </div>
    </section>
  )
}
