import type { CSSProperties } from 'react'

const photos: { src: string; alt: string; w: number; h: number; caption: string; style?: CSSProperties }[] = [
  { src: 'assets/kiosk-floor-standing-gameplay.jpg', alt: '落地式直身運動站放在校園有蓋地方，屏幕顯示鏡頭畫面和遊戲', w: 1440, h: 1920, caption: '落地式運動站' },
  { src: 'assets/kiosk-wall-mounted-menu.jpg', alt: '牆上的大電視顯示藍色運動項目選單，上方裝有鏡頭', w: 1920, h: 1143, caption: '壁掛大屏' },
  { src: 'assets/kiosk-joyful-arena-wall.jpg', alt: '畫有壁畫的活動室牆上裝有大屏和鏡頭', w: 1920, h: 1210, caption: '配合校園佈置' },
  { src: 'assets/kiosk-portrait-screen-closeup.jpg', alt: '直身運動站屏幕近照，顯示計時器和參加者位置', w: 1920, h: 1440, caption: '直身屏幕介面' },
  { src: 'assets/student-covered-playground-kiosk.jpg', alt: '一名學生在有蓋操場上，於可移動支架上的運動站前運動', w: 1440, h: 1920, caption: '有蓋操場', style: { objectPosition: '50% 40%' } },
]

const specs = [
  ['運動站', '大屏 AI 運動站'],
  ['鏡頭', '1080p USB 鏡頭'],
  ['其他版本', '支援 iPad'],
  ['場地', '走廊、禮堂、有蓋操場'],
]

export default function Hardware() {
  return (
    <section className="sec" id="hardware" aria-labelledby="hw-title" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="sec-head">
          <h2 id="hw-title">安裝簡單，適合各種場地</h2>
          <p>可選落地式運動站、壁掛大屏或 iPad 版本。年級及班別可在管理員設定中按學校情況調整，亦可顯示學校標誌及校名。</p>
        </div>
        <div className="deploy-grid">
          {photos.map((p) => (
            <figure key={p.src}><img src={p.src} alt={p.alt} loading="lazy" width={p.w} height={p.h} style={p.style} /><figcaption>{p.caption}</figcaption></figure>
          ))}
        </div>
        <dl className="spec">
          {specs.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </div>
    </section>
  )
}
