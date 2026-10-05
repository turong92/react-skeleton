import { Turnstile, attachTurnstileToken, useTurnstileToken } from '@skeleton/captcha-turnstile'
import { Button } from '@skeleton/ui'
import { useState } from 'react'
import { Case, Row } from '../components/Section'
import { createFakeTurnstile } from '../fakes/fakeTurnstile'

/** Cloudflare 스크립트 대신 가짜 `loader` — 사람이 위젯을 푼 것처럼 토큰을 준다 */
export function CaptchaDemo() {
  const [fake] = useState(createFakeTurnstile)
  const captcha = useTurnstileToken()
  return (
    <>
      <Case label="<Turnstile loader={fake} />">
        <Turnstile siteKey="demo-site-key" loader={fake.loader} {...captcha.widgetProps} />
        <Row>
          <Button size="sm" variant="secondary" onClick={fake.solve}>
            위젯 풀기(가짜)
          </Button>
          <Button size="sm" variant="ghost" onClick={fake.expire}>
            만료시키기
          </Button>
        </Row>
      </Case>
      <Case label="token">
        <code>{captcha.token ?? '(없음 — 제출 버튼을 막는다)'}</code>
      </Case>
      <Case label="attachTurnstileToken(body, token)">
        <pre>
          <code>
            {captcha.token
              ? JSON.stringify(attachTurnstileToken({ email: 'a@b.c' }, captcha.token), null, 2)
              : '토큰이 올 때까지 붙일 수 없다 (TurnstileTokenMissingError)'}
          </code>
        </pre>
      </Case>
    </>
  )
}
