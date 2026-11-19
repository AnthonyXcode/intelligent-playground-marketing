export default function Why() {
  return (
    <section className="sec why" aria-labelledby="why-title">
      <div className="wrap">
        <div>
          <div className="sixty" aria-hidden="true"><b>60</b><span>分鐘</span></div>
          <h2 id="why-title">每天 60 分鐘，學生做到嗎？</h2>
          <p className="who">世界衞生組織建議 5–17 歲兒童及青少年每天平均累積最少 60 分鐘中等至劇烈強度體能活動（MVPA60）。</p>
          <ul className="gap-list">
            <li>體育課時有限</li>
            <li>小息、午飯時間多數靜坐</li>
            <li>老師難以逐一督導</li>
            <li>活動量欠缺數據記錄</li>
          </ul>
          <p className="policy"><strong>體育，正式計分。</strong>教育局優化中學學位分配「校內成績評估」安排，體育比重由 0 增至 2，2026/27 學年小五下學期起實施。</p>
        </div>
        <figure>
          <img src="assets/students-hall-high-knees.jpg" alt="三位學生在禮堂的大屏前做高抬腿，屏幕上方裝有鏡頭" width="1920" height="1440" loading="lazy" />
          <figcaption>運動站裝在禮堂牆上，學生站在大屏前就可以開始。</figcaption>
        </figure>
      </div>
    </section>
  )
}
