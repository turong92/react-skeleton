import { buildAuthorizeUrl, SOCIAL_AUTHORIZE_PRESETS } from '@skeleton/auth'
import { Field, Input, Select } from '@skeleton/ui'
import { useState } from 'react'
import styles from './Demo.module.css'

/** `@skeleton/auth` 의 소셜 로그인 도우미 — authorize 주소 만들기(백엔드는 돌아온 code 만 받는다: `POST /auth/social/{provider}/login`) */
export function SocialDemo() {
  const [provider, setProvider] = useState('google')
  const [clientId, setClientId] = useState('YOUR_CLIENT_ID')
  const redirectUri = `${typeof window === 'undefined' ? '' : window.location.origin}/auth/callback`
  return (
    <div className={styles.stack}>
      <p className={styles.note}>
        돌아온 콜백은 <code>createSocialLoginFlow(...).complete(location.search)</code> 가 state 를
        확인하고 <code>socialLogin(provider, code, redirectUri)</code> 를 부른다.
      </p>
      <div className={styles.row}>
        <Field label="제공자">
          {(c) => (
            <Select {...c} value={provider} onChange={(e) => setProvider(e.target.value)}>
              {Object.keys(SOCIAL_AUTHORIZE_PRESETS).map((id) => (
                <option key={id}>{id}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="client id(공개값)">
          {(c) => <Input {...c} value={clientId} onChange={(e) => setClientId(e.target.value)} />}
        </Field>
      </div>
      <pre>{buildAuthorizeUrl(provider, { clientId, redirectUri }, 'demo-state')}</pre>
    </div>
  )
}
