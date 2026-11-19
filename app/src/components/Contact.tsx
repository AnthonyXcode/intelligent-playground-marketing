import { useState, type FormEvent } from 'react'
import { CONTACT_EMAIL, fundOptions } from '../content'
import { buildMailto, invalidFields } from '../mailto'
import { refCode, trackEvent } from '../track'

const SENT_MSG = `已開啟你的電郵程式，請按「傳送」。如沒有自動開啟，請直接電郵至 ${CONTACT_EMAIL}。`

export default function Contact() {
  const [status, setStatus] = useState('')

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const get = (k: string) => String(fd.get(k) ?? '')
    const req = {
      school: get('school'),
      name: get('name'),
      role: get('role'),
      email: get('email'),
      tel: get('tel'),
      funds: fd.getAll('fund').map(String),
      ref: refCode(),
    }
    const bad = invalidFields(req)
    if (bad.length) {
      setStatus('請填寫學校名稱、聯絡人及有效電郵。')
      const el = form.elements.namedItem(bad[0])
      if (el instanceof HTMLInputElement) el.focus()
      return
    }
    setStatus(SENT_MSG)
    trackEvent('contact')
    window.location.href = buildMailto(req)
  }

  return (
    <section className="sec contact" id="contact" aria-labelledby="contact-title">
      <div className="wrap">
        <div>
          <h2 id="contact-title">預約到校示範</h2>
          <p className="lede">讓學生親身試一次，看看小息可以有多大改變。</p>
          <ul>
            <li>到校示範及場地評估</li>
            <li>按學校需要報價</li>
            <li>協助資助申請文件</li>
          </ul>
          <p className="direct">Ant-App Limited｜陳先生｜電郵 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>｜電話 <a href="tel:+85262247029">6224 7029</a></p>
          <div className="photo"><img src="assets/student-raise-hand-outdoor.jpg" alt="一名學生背向鏡頭，在校園的運動站前舉起手" loading="lazy" width="1440" height="1920" /></div>
        </div>
        <form className="demo" id="demoForm" noValidate onSubmit={onSubmit}>
          <div><label htmlFor="f-school">學校名稱</label><input id="f-school" name="school" type="text" autoComplete="organization" required /></div>
          <div><label htmlFor="f-name">聯絡人</label><input id="f-name" name="name" type="text" autoComplete="name" required /></div>
          <div className="full"><label htmlFor="f-role">職位</label><input id="f-role" name="role" type="text" autoComplete="organization-title" placeholder="例如：體育科主任" /></div>
          <div><label htmlFor="f-email">電郵</label><input id="f-email" name="email" type="email" autoComplete="email" required /></div>
          <div><label htmlFor="f-tel">電話</label><input id="f-tel" name="tel" type="tel" autoComplete="tel" inputMode="tel" /></div>
          <fieldset className="full">
            <legend>想了解的資助</legend>
            <div className="checks">
              {fundOptions.map((o) => (
                <label key={o.value}><input type="checkbox" name="fund" value={o.value} />{o.label}</label>
              ))}
            </div>
          </fieldset>
          <button className="btn btn-tape full" type="submit">預約到校示範</button>
          <p className="form-status full" id="formStatus" role="status" aria-live="polite">{status}</p>
        </form>
      </div>
    </section>
  )
}
