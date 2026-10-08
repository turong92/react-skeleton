import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOGIN_ID_RULES } from '../account/loginIdRules'
import { EmailSection } from './EmailSection'
import { koAuthLabels } from './labels.ko'
import { LoginIdSection } from './LoginIdSection'
import type { ReauthSubject } from '../reauth/kind'

const html = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)
const noop = async () => undefined
const api = { checkLoginId: async () => ({ normalized: 'x', available: true }) }

const section = (extra: Partial<React.ComponentProps<typeof LoginIdSection>> = {}) =>
  html(
    <LoginIdSection
      loginId="sumin.kim"
      hasPassword
      email="a@b.c"
      provider="kakao"
      rules={DEFAULT_LOGIN_ID_RULES}
      api={api}
      onSubmit={noop}
      onChosen={() => undefined}
      onAlreadySet={() => undefined}
      labels={koAuthLabels}
      {...extra}
    />,
  )

describe('settings login id row (design §13.1, §12)', () => {
  it('a chosen id with a password: the value and "cannot be changed" - nothing to edit', () => {
    const out = section()
    expect(out).toContain('sumin.kim')
    expect(out).toContain('바꿀 수 없어요')
    expect(out).not.toContain('<input')
    expect(out).not.toContain('<button')
    expect(out).not.toContain('<form')
  })

  it('a chosen id without a password: says how they sign in now and offers "set a password" when there is an address', () => {
    const out = section({ hasPassword: false, onGo: () => undefined })
    expect(out).toContain('바꿀 수 없어요')
    expect(out).toContain(
      '지금은 카카오(으)로 로그인해요. 비밀번호를 만들면 아이디나 이메일로도 로그인할 수 있어요.',
    )
    // 단추는 테두리가 있다(글자만 있는 단추 금지)
    expect(out).toMatch(/<button[^>]*data-variant="secondary"[^>]*>비밀번호 만들기<\/button>/)
    expect(out).not.toContain('이메일 등록하기')
  })

  it('without an address the button goes to the email section instead', () => {
    const out = section({ hasPassword: false, email: null, onGo: () => undefined })
    expect(out).toMatch(/<button[^>]*data-variant="secondary"[^>]*>이메일 등록하기<\/button>/)
    expect(out).not.toContain('비밀번호 만들기')
  })

  it('no button when the app did not give a place to go (the target section is off)', () => {
    const out = section({ hasPassword: false })
    expect(out).toContain('지금은 카카오(으)로 로그인해요')
    expect(out).not.toContain('<button')
  })

  it('a password account never gets the notice', () => {
    expect(section({ hasPassword: true, onGo: () => undefined })).not.toContain('지금은 카카오')
  })

  it('not chosen yet: the same field and one filled primary button, and the same confirmation dialog', () => {
    const out = section({ loginId: null })
    expect(out).toMatch(/<label[^>]*>아이디/)
    expect(out).toContain('autoComplete="username"')
    expect(out).toMatch(/<button[^>]*data-variant="primary"[^>]*>이 아이디로 정하기<\/button>/)
    expect(out).not.toContain('바꿀 수 없어요</') // 값 줄이 아니다
    expect(out).toContain('정한 뒤에는 바꿀 수 없어요.') // 확인 대화상자의 본문
  })

  it('names the provider in English by default', () => {
    expect(section({ labels: undefined, hasPassword: false, onGo: () => undefined })).toContain(
      'You sign in with Kakao now.',
    )
  })
})

describe('email section: register to write', () => {
  const subject: ReauthSubject = { hasPassword: false, email: null, providers: ['kakao'] }
  const email = (extra: Partial<React.ComponentProps<typeof EmailSection>> = {}) =>
    html(
      <EmailSection
        email={null}
        verified={false}
        subject={subject}
        requestReauthCode={noop}
        onChangeEmail={noop}
        onConfirmCode={noop}
        labels={koAuthLabels}
        {...extra}
      />,
    )
  it('says why when the server only wants the address to write', () => {
    expect(email({ registerToWrite: true })).toContain('이메일을 등록하면 글을 쓸 수 있어요.')
  })
  it('says nothing extra otherwise', () => {
    expect(email()).not.toContain('글을 쓸 수 있어요')
  })
})
