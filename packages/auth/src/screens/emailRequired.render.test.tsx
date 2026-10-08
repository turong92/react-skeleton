import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createEmailRequiredController } from '../emailRequired'
import { createFakeAccountApi } from '../stories/fakeAccountApi'
import { ContactEmailSection } from './ContactEmailSection'
import { EmailRequiredGate } from './EmailRequiredGate'
import { EmailRequiredScreen } from './EmailRequiredScreen'
import { EmailSection } from './EmailSection'
import { koAuthLabels } from './labels.ko'
import type { ReauthSubject } from '../reauth/kind'

const html = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)
const noop = async () => undefined
const kakaoOnly: ReauthSubject = { hasPassword: false, email: null, providers: ['kakao'] }

const screen = (labels = koAuthLabels) =>
  html(
    <EmailRequiredScreen
      providers={['kakao']}
      labels={labels}
      onRequestCode={noop}
      onConfirmCode={noop}
      onRegistered={() => undefined}
      onSignOut={() => undefined}
      onDiscard={noop}
      onDiscarded={() => undefined}
    />,
  )

describe('EmailRequiredScreen (the full-screen "register your email" step)', () => {
  it('says what and why in plain Korean, with one filled primary action and the ways out as real buttons', () => {
    const out = screen()
    expect(out).toContain('이메일을 등록해 주세요')
    expect(out).toContain(
      '계정을 되찾거나 중요한 안내를 받을 때 써요. 다른 사람에게는 보이지 않아요.',
    )
    expect(out).toContain('role="dialog"')
    expect(out).toContain('aria-modal="true"')
    expect(out).toContain('type="email"')
    expect(out).toMatch(
      /<button[^>]*data-variant="primary"[^>]*type="submit"|<button[^>]*type="submit"[^>]*data-variant="primary"/,
    )
    expect(out).toContain('인증번호 받기')
    // 떠나는 길도 눌리는 단추(글자만 있는 링크가 아니다)
    expect(out).toMatch(/<button[^>]*data-variant="secondary"[^>]*>로그아웃<\/button>/)
    // 이미 계정이 있을 때의 길 - 위험색 단추(누르면 한 번 확인한다)
    expect(out).toContain('이미 계정이 있나요?')
    expect(out).toMatch(
      /<button[^>]*data-variant="danger"[^>]*>이 계정 지우고 로그인 화면으로<\/button>/,
    )
  })

  it('shows the same in English by default', () => {
    const out = screen({} as typeof koAuthLabels)
    expect(out).toContain('Add your email address')
    expect(out).toContain('Send me a code')
  })
})

describe('EmailRequiredGate', () => {
  const api = createFakeAccountApi({ emailRequired: true })
  const gate = (controller = createEmailRequiredController(), standAside = false) =>
    html(
      <EmailRequiredGate
        controller={controller}
        api={api}
        accountId="a"
        labels={koAuthLabels}
        standAside={standAside}
        onSignOut={() => undefined}
        onDiscarded={() => undefined}
      >
        <p>앱 화면</p>
      </EmailRequiredGate>,
    )

  it('never draws the account id, on the screen or around it', () => {
    const controller = createEmailRequiredController()
    controller.require()
    const out = html(
      <EmailRequiredGate
        controller={controller}
        api={api}
        accountId="acc_secret_1234"
        labels={koAuthLabels}
        onSignOut={() => undefined}
        onDiscarded={() => undefined}
      >
        <p>앱 화면</p>
      </EmailRequiredGate>,
    )
    expect(out).toContain('이메일을 등록해 주세요')
    expect(out).not.toContain('acc_secret_1234')
  })

  it('idle: only the app, nothing covers it', () => {
    const out = gate()
    expect(out).toContain('앱 화면')
    expect(out).not.toContain('role="dialog"')
    expect(out).not.toContain('inert')
  })

  it('required: the app below is inert and the screen covers it — one thing at a time', () => {
    const controller = createEmailRequiredController()
    controller.require()
    const out = gate(controller)
    expect(out).toContain('inert')
    expect(out).toContain('이메일을 등록해 주세요')
  })

  it('stands aside on the account page (register or delete there): app alive, no cover', () => {
    const controller = createEmailRequiredController()
    controller.require()
    const out = gate(controller, true)
    expect(out).not.toContain('role="dialog"')
    expect(out).not.toContain('inert')
  })
})

describe('contact email section', () => {
  const props = { onRequestCode: noop, onConfirmCode: noop, onRemove: noop, labels: koAuthLabels }

  it('none: says where notices go, optional, and offers one filled "register" button', () => {
    const out = html(<ContactEmailSection {...props} contactEmail={null} />)
    expect(out).toContain('연락받을 이메일')
    expect(out).toContain('계정 이메일로 받아요')
    expect(out).toContain('로그인이나 비밀번호 찾기에는 쓰이지 않아요')
    expect(out).toMatch(/<button[^>]*data-variant="primary"[^>]*>연락받을 이메일 등록<\/button>/)
  })

  it('set: shows the address and change / remove as buttons that look pressable', () => {
    const out = html(<ContactEmailSection {...props} contactEmail="news@example.com" />)
    expect(out).toContain('news@example.com')
    expect(out).toMatch(/<button[^>]*data-variant="secondary"[^>]*>바꾸기<\/button>/)
    expect(out).toMatch(/<button[^>]*data-variant="danger"[^>]*>지우기<\/button>/)
    expect(out).toContain('보안 메일은 늘 계정 이메일로만 가요')
  })
})

describe('account email section on an app that requires one', () => {
  const base = {
    verified: true,
    requestReauthCode: noop,
    onChangeEmail: noop,
    onConfirmCode: noop,
    labels: koAuthLabels,
  }

  it('states what it is for and that it cannot be removed (only on apps that require one)', () => {
    const out = html(
      <EmailSection
        {...base}
        email="a@example.com"
        required
        subject={{ hasPassword: true, email: 'a@example.com', providers: [] }}
      />,
    )
    expect(out).toContain('계정 이메일')
    expect(out).toContain('로그인, 비밀번호 찾기, 보안 알림에 쓰여요.')
    expect(out).toContain('지울 수는 없고')
    const optional = html(
      <EmailSection
        {...base}
        email="a@example.com"
        subject={{ hasPassword: true, email: 'a@example.com', providers: [] }}
      />,
    )
    expect(optional).not.toContain('지울 수는 없고')
  })

  it('first registration on an app that requires an address asks for the address only: no provider button until the server wants one', () => {
    const out = html(<EmailSection {...base} email={null} required subject={kakaoOnly} />)
    expect(out).toContain('이메일 추가')
    expect(out).not.toContain('data-testid="reauth-provider"')
    expect(out).toContain('아래에 주소를 적으면 인증번호를 보내 드려요')
  })

  it('an app that does not require one keeps the old order: the provider button comes first, with a hint that says so (no 403 needed)', () => {
    const out = html(<EmailSection {...base} email={null} subject={kakaoOnly} />)
    expect(out).toContain('data-testid="reauth-provider"')
    expect(out).toContain('지금 쓰는 로그인 수단으로 본인임을 확인')
    expect(out).not.toContain('아래에 주소를 적으면 인증번호를 보내 드려요')
  })
})
