import { CONTACT_EMAIL } from './content'

export interface DemoRequest {
  school: string
  name: string
  role: string
  email: string
  tel: string
  funds: string[]
  /** Link code from an outreach email (?r=), if the visitor came from one. */
  ref?: string
}

export const EMAIL_RE = /^\S+@\S+\.\S+$/

/** Returns the names of required fields that are missing/invalid, in form order. */
export function invalidFields(r: Pick<DemoRequest, 'school' | 'name' | 'email'>): ('school' | 'name' | 'email')[] {
  const bad: ('school' | 'name' | 'email')[] = []
  if (!r.school.trim()) bad.push('school')
  if (!r.name.trim()) bad.push('name')
  if (!r.email.trim() || !EMAIL_RE.test(r.email)) bad.push('email')
  return bad
}

export function buildMailto(r: DemoRequest): string {
  const subject = `預約到校示範 – ${r.school.trim()}`
  const body = [
    `學校名稱：${r.school.trim()}`,
    `聯絡人：${r.name.trim()}`,
    `職位：${r.role.trim()}`,
    `電郵：${r.email.trim()}`,
    `電話：${r.tel.trim()}`,
    `想了解的資助：${r.funds.join('、')}`,
    ...(r.ref ? [`參考編號：${r.ref}`] : []),
  ].join('\r\n')
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
