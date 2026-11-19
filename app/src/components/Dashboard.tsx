// Illustrative teacher dashboard. All numbers are fictional (marked 示意圖).
const days = ['一', '二', '三', '四', '五']
const slots = ['早會前', '小息一', '小息二', '午飯', '放學後']
const heatData = [[1, 3, 2, 4, 1], [1, 3, 3, 4, 2], [0, 2, 3, 4, 1], [1, 4, 3, 3, 2], [1, 3, 2, 4, 3]]
const heatCols = ['#E4F4F2', '#C7EAE6', '#A9E0DB', '#5DB5B4', '#0D687A']
const grades: [string, number][] = [['小一', 58], ['小二', 66], ['小三', 72], ['小四', 81], ['小五', 77], ['小六', 49]]
const dist = [34, 72, 100, 63, 38, 17]
const distLabels = ['<10', '10–20', '20–30', '30–45', '45–60', '60+']
const classRank: [string, string][] = [['4C', '46'], ['5A', '41'], ['3B', '38'], ['4A', '35']]
const students: [string, string][] = [['5A 班 12 號', '3 小時 8 分'], ['4C 班 03 號', '2 小時 51 分'], ['4C 班 27 號', '2 小時 40 分']]

function Heatmap() {
  return (
    <div className="heat" id="heat">
      <span></span>
      {days.map((d) => <span className="h" key={d}>{d}</span>)}
      {slots.flatMap((sl, r) => [
        <span className="rl" key={sl}>{sl}</span>,
        ...days.map((d, c) => <span className="c" key={sl + d} style={{ background: heatCols[heatData[c][r]] }}></span>),
      ])}
    </div>
  )
}

export default function Dashboard() {
  return (
    <section className="sec dash-sec" id="dashboard" aria-labelledby="dash-title">
      <div className="wrap">
        <div className="sec-head">
          <h2 id="dash-title">教師數據後台</h2>
          <p>誰在郁、郁幾耐、幾時郁，一目了然。網上後台，電腦和手機都可查看。</p>
        </div>
        <div className="dash-wrap">
          <ul className="dash-points">
            <li><strong>參與分析</strong><span>各年級、班級及學生的參與情況</span></li>
            <li><strong>運動時間</strong><span>人均運動時間、每位學生的總運動時間</span></li>
            <li><strong>使用時段</strong><span>時段及星期分佈，方便安排課堂</span></li>
            <li><strong>運動項目分析</strong><span>最受歡迎的項目及模式</span></li>
            <li><strong>排行榜</strong><span>班級排行、最活躍學生</span></li>
            <li><strong>報告</strong><span>一鍵列印</span></li>
          </ul>
          <div>
            <figure className="browser" role="img" aria-label="教師後台示意圖：顯示參與學生人數、總運動時數、人均運動時間，各年級參與率棒形圖，時段及星期熱力圖，班級排行及最活躍學生。所有數字均為虛構示例。" style={{ margin: 0 }}>
              <div className="bar" aria-hidden="true"><i></i><i></i><i></i><span>學校後台 ／ 數據總覽</span></div>
              <span className="demo-stamp" aria-hidden="true">示意圖</span>
              <div className="dash" aria-hidden="true">
                <div className="dash-top">
                  <h3>數據總覽</h3>
                  <span className="range">2026-09-01 至 2026-10-31</span>
                  <span className="print">列印報告</span>
                </div>
                <div className="kpis">
                  <div className="kpi"><small>參與學生人數</small><b>418<em>人</em></b></div>
                  <div className="kpi"><small>期間總運動時數</small><b>203<em>小時</em></b></div>
                  <div className="kpi"><small>人均運動時間</small><b>29<em>分鐘</em></b></div>
                </div>
                <div className="panels">
                  <div className="panel">
                    <h4>各年級參與率</h4>
                    <div className="bars">
                      {grades.map(([g, v]) => (
                        <div className="bar-row" key={g}><span>{g}</span><div className="track"><div className="fill" style={{ width: `${v}%` }}></div></div><span className="v">{v}%</span></div>
                      ))}
                    </div>
                  </div>
                  <div className="panel">
                    <h4>使用時段 × 星期</h4>
                    <Heatmap />
                    <div className="heat-key"><span>少</span><i style={{ background: '#E4F4F2' }}></i><i style={{ background: '#A9E0DB' }}></i><i style={{ background: '#5DB5B4' }}></i><i style={{ background: '#0D687A' }}></i><span>多</span></div>
                  </div>
                  <div className="panel">
                    <h4>每位學生總運動時間（人數）</h4>
                    <div className="dist">
                      {dist.map((h, i) => <div key={i} style={{ height: `${h}%` }}></div>)}
                    </div>
                    <div className="dist-l">{distLabels.map((l) => <span key={l}>{l}</span>)}</div>
                    <div className="dist-l" style={{ justifyContent: 'center' }}><span>分鐘</span></div>
                  </div>
                  <div className="panel">
                    <h4>班級排行（人均分鐘）</h4>
                    <ol className="rank">
                      {classRank.map(([c, v], i) => <li key={c}><b>{i + 1}</b><span>{c}</span><span>{v}</span></li>)}
                    </ol>
                  </div>
                  <div className="panel" style={{ gridColumn: '1/-1' }}>
                    <h4>最活躍學生（按班別學號）</h4>
                    <ol className="rank" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
                      {students.map(([s, t], i) => <li key={s}><b>{i + 1}</b><span>{s}</span><span>{t}</span></li>)}
                    </ol>
                  </div>
                </div>
              </div>
            </figure>
            <p className="dash-note">示意圖：介面經簡化，所有數字均為虛構示例，並非真實學校數據。</p>
          </div>
        </div>
      </div>
    </section>
  )
}
