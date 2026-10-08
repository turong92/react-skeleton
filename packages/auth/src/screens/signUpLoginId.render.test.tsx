import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { FAKE_POLICY } from '../test/apiFixtures'
import { koAuthLabels } from './labels.ko'
import { LoginIdRetry } from './LoginIdRetry'
import { SignUpScreen } from './SignUpScreen'

const html = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)
const noop = async () => undefined
const base = {
  policy: FAKE_POLICY,
  onSignUp: async () => ({ status: 'VERIFICATION_SENT' as const }),
  onVerifyCode: noop,
}
const api = { checkLoginId: async (id: string) => ({ available: true, normalized: id }) }
const rules = { minLength: 4, maxLength: 20 }

/* 설계 §13.1 - 가입의 아이디 칸은 발견에 loginId 키가 있을 때만. 키가 없으면 화면이 지금과 같다 */
describe('SignUpScreen - login id field', () => {
  it('without the key the screen has no username field', () => {
    const out = html(<SignUpScreen {...base} />)
    expect(out).not.toContain('autoComplete="username"')
    expect(out).not.toContain('-login-id')
    expect(out).not.toContain('Username')
  })

  it('with the key the field sits after the email and before the password', () => {
    const out = html(<SignUpScreen {...base} loginId={{ rules, api }} />)
    expect(out).toContain('autoComplete="username"')
    const email = out.indexOf('type="email"')
    const id = out.indexOf('autoComplete="username"')
    const password = out.indexOf('type="password"')
    expect(email).toBeGreaterThan(-1)
    expect(id).toBeGreaterThan(email)
    expect(password).toBeGreaterThan(id)
  })

  it('the email input is autoComplete=email, with or without the key', () => {
    for (const props of [{}, { loginId: { rules, api } }]) {
      const out = html(<SignUpScreen {...base} {...props} />)
      expect(out).toMatch(
        /type="email"[^>]*autoComplete="email"|autoComplete="email"[^>]*type="email"/,
      )
    }
  })

  it('does not tell people to pick a different username from other places (decided)', () => {
    const out = html(<SignUpScreen {...base} labels={koAuthLabels} loginId={{ rules, api }} />)
    expect(out).not.toContain('다른 곳')
    expect(out).toContain(koAuthLabels.loginIdHint(4, 20))
  })
})

describe('LoginIdRetry', () => {
  const retry = (props: Partial<React.ComponentProps<typeof LoginIdRetry>> = {}) =>
    html(
      <LoginIdRetry
        initialValue="sumin"
        rules={rules}
        api={api}
        labels={koAuthLabels}
        onSubmit={() => undefined}
        {...props}
      />,
    )

  it('says someone took the id meanwhile and that no new code is needed, with the field and a filled submit', () => {
    const out = retry({ error: koAuthLabels.errorLoginIdTaken })
    expect(out).toContain(koAuthLabels.loginIdRetryHint)
    expect(out).toContain('autoComplete="username"')
    expect(out).toContain('value="sumin"')
    expect(out).toContain(koAuthLabels.errorLoginIdTaken)
    expect(out).toContain(koAuthLabels.loginIdRequiredSubmit)
    expect(out).toContain('type="submit"')
  })
})
