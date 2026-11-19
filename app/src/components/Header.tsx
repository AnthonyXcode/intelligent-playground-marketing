export default function Header() {
  return (
    <>
      <a className="skip" href="#main">跳到主要內容</a>
      <header className="top">
        <div className="wrap">
          <a className="brand" href="#top" aria-label="Intelligent Playground 智能運動場 首頁">
            <img src="assets/mascot-icon-128.png" alt="" width="40" height="40" />
            <span>智能運動場<small>Intelligent Playground</small></span>
          </a>
          <nav className="nav" aria-label="主要導覽">
            <a href="#how">點樣用</a>
            <a href="#exercises">運動項目</a>
            <a href="#dashboard">教師後台</a>
            <a href="#funding">資助</a>
            <a href="#faq">常見問題</a>
            <a className="btn btn-tape" href="#contact">預約示範</a>
          </nav>
        </div>
      </header>
    </>
  )
}
