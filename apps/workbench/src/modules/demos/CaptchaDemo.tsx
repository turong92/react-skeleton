import { attachTurnstileToken, Turnstile, useTurnstileToken } from '@skeleton/captcha-turnstile'
import { Button, Field, Input } from '@skeleton/ui'
import { useState } from 'react'
import styles from './Demo.module.css'

/** Cloudflare 가 공개한 테스트 사이트 키(항상 통과) */
const TEST_SITE_KEY = '1x00000000000000000000AA'

/** `@skeleton/captcha-turnstile` — 위젯 → 토큰 → 요청 본문에 붙이기. 검증은 백엔드 `TurnstileVerifier` 가 한다(이 화면은 안 부른다) */
export function CaptchaDemo() {
  const [siteKey, setSiteKey] = useState(TEST_SITE_KEY)
  const captcha = useTurnstileToken()
  return (
    <div className={styles.stack}>
      <p className={styles.note}>
        위젯 스크립트는 이 탭을 열 때 Cloudflare 에서 불러온다(네트워크 필요). 토큰은 한 번만
        쓰인다.
      </p>
      <Field label="사이트 키(공개값)">
        {(c) => <Input {...c} value={siteKey} onChange={(e) => setSiteKey(e.target.value)} />}
      </Field>
      <Turnstile siteKey={siteKey} action="demo" {...captcha.widgetProps} />
      <div className={styles.row}>
        <Button variant="secondary" onClick={captcha.reset}>
          새 토큰
        </Button>
      </div>
      <pre>
        {captcha.token
          ? JSON.stringify(
              attachTurnstileToken({ email: 'demo@example.com' }, captcha.token),
              null,
              2,
            )
          : '(토큰 없음 — 제출 버튼을 막는 상태)'}
      </pre>
    </div>
  )
}
