import { exercises, modes, type ExerciseSvg } from '../content'

const svgProps = { viewBox: '0 0 64 64', fill: 'none', stroke: '#fff', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

function ExerciseIcon({ kind }: { kind: ExerciseSvg }) {
  switch (kind) {
    case 'plank':
      return <svg {...svgProps}><circle cx="51" cy="30" r="4.5" /><path d="M46 33 14 38" /><path d="M14 38l-3 4" /><path d="M40 34l1 9h5" /><path d="M10 46h44" opacity=".5" /></svg>
    case 'swim':
      return <svg {...svgProps}><circle cx="44" cy="22" r="4.5" /><path d="M14 32l14-4 12 4" /><path d="M28 28l8-8 8 4" /><path d="M8 42c4-3 8-3 12 0s8 3 12 0 8-3 12 0 8 3 12 0" /><path d="M8 50c4-3 8-3 12 0s8 3 12 0 8-3 12 0 8 3 12 0" opacity=".5" /></svg>
    case 'dribble':
      return <svg {...svgProps}><circle cx="32" cy="32" r="20" /><path d="M12 32h40" /><path d="M32 12v40" /><path d="M18 18c6 6 6 22 0 28" /><path d="M46 18c-6 6-6 22 0 28" /></svg>
  }
}

export default function Exercises() {
  return (
    <section className="sec" id="exercises" aria-labelledby="ex-title">
      <div className="wrap">
        <div className="sec-head">
          <h2 id="ex-title">12 個項目，3 種玩法</h2>
          <p>體適能訓練加遊戲化挑戰。每個項目都有卡通示範動畫，提醒學生正確動作。</p>
        </div>
        <div className="ex-legend" aria-hidden="true"><span><i></i>體適能（9 項）</span><span><i className="g"></i>遊戲化（3 項）</span></div>
        <ul className="ex-grid" aria-label="運動項目">
          {exercises.map((e) => (
            <li key={e.name} className={e.game ? 'ex game' : 'ex'}>
              {e.icon ? <img src={e.icon} alt="" /> : e.svg ? <ExerciseIcon kind={e.svg} /> : null}
              {e.name}
              {e.tag && <span className="tag">{e.tag}</span>}
            </li>
          ))}
        </ul>
        <div className="modes">
          {modes.map((m) => (
            <div className="mode" key={m.title}>
              <h3>{m.title}</h3><span className="en" lang="en">{m.en}</span>
              <p>{m.text}</p>
            </div>
          ))}
        </div>
        <p className="ex-foot"><strong>運球高手（Beta）</strong>：單人 60 秒運球挑戰，設簡單、中等、困難三個難度。AI 偵測籃球，分開計算左右手運球；困難級要一邊運球，一邊觸碰屏幕上的星星。須使用籃球。</p>
        <p className="ex-foot">每個項目設有首十名排行榜。項目會持續更新。</p>
      </div>
    </section>
  )
}
