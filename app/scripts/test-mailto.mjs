// Quick check of the mailto URL generation (runs the TS source via Vite's SSR loader).
import { createServer } from 'vite'
import assert from 'node:assert/strict'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
try {
  const { buildMailto, invalidFields } = await vite.ssrLoadModule('/src/mailto.ts')
  assert.deepEqual(invalidFields({ school: ' ', name: 'A', email: 'bad' }), ['school', 'email'])
  assert.deepEqual(invalidFields({ school: 'S', name: 'A', email: 'a@b.co' }), [])
  const url = buildMailto({ school: '聖保羅小學', name: '陳老師', role: '體育科主任', email: 'chan@school.edu.hk', tel: '2345 6789', funds: ['MVPA60', 'QEF'] })
  console.log(url)
  assert.ok(url.startsWith('mailto:anthonychan@ant-app.ai?subject='))
  const q = new URLSearchParams(url.split('?')[1])
  assert.equal(q.get('subject'), '預約到校示範 – 聖保羅小學')
  assert.equal(q.get('body'), '學校名稱：聖保羅小學\r\n聯絡人：陳老師\r\n職位：體育科主任\r\n電郵：chan@school.edu.hk\r\n電話：2345 6789\r\n想了解的資助：MVPA60、QEF')
  console.log('mailto OK')
} finally {
  await vite.close()
}
