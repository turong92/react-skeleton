import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koAuthLabels } from '../screens/labels.ko'
import { apiError } from '../test/apiFixtures'
import type { MfaApi } from './mfaApi'
import { createMfaEnrollmentRequiredController } from './mfaEnrollmentRequired'
import { MfaEnrollmentRequiredGate } from './MfaEnrollmentRequiredGate'
import { MfaEnrollmentRequiredScreen } from './MfaEnrollmentRequiredScreen'

const unused = async () => {
  throw new Error('unused') // 정적 렌더라 효과도 호출도 돌지 않는다
}
const api: MfaApi = {
  status: unused,
  startEnrollment: unused,
  confirmEnrollment: unused,
  regenerateRecoveryCodes: unused,
  disable: unused,
}
const account = {
  me: async () => ({}) as never, // 정적 렌더라 효과(`me` 읽기)는 돌지 않는다
  requestReauthConfirmation: async () => undefined as never,
}
const gate = (controller = createMfaEnrollmentRequiredController(), standAside = false) =>
  renderToStaticMarkup(
    <MfaEnrollmentRequiredGate
      controller={controller}
      api={api}
      account={account}
      accountId="a"
      labels={koAuthLabels}
      standAside={standAside}
      onSignOut={() => undefined}
    >
      <p>앱 화면</p>
    </MfaEnrollmentRequiredGate>,
  )

describe('MfaEnrollmentRequiredGate', () => {
  it('idle: only the app, nothing covers it', () => {
    const out = gate()
    expect(out).toContain('앱 화면')
    expect(out).not.toContain('role="dialog"')
    expect(out).not.toContain('inert')
  })

  it('a MFA.ENROLLMENT_REQUIRED 403 covers the app with the screen and leaves the app inert (no way to click around the door)', () => {
    const controller = createMfaEnrollmentRequiredController()
    void controller.recover({
      path: '/notes',
      method: 'GET',
      error: apiError('MFA.ENROLLMENT_REQUIRED', 403),
    })
    const out = gate(controller)
    expect(out).toContain('2단계 인증을 켜 주세요')
    expect(out).toContain('inert')
    expect(out).toContain('앱 화면') // 아래 화면은 살아 있다 - 켜면 가던 자리에서 이어진다
  })

  it('on the account settings page the screen steps aside so the wizard there can run', () => {
    const controller = createMfaEnrollmentRequiredController()
    void controller.recover({
      path: '/notes',
      method: 'GET',
      error: apiError('MFA.ENROLLMENT_REQUIRED', 403),
    })
    const out = gate(controller, true)
    expect(out).not.toContain('role="dialog"')
    expect(out).not.toContain('inert')
  })
})

describe('MfaEnrollmentRequiredScreen', () => {
  const screen = (subject = { hasPassword: true, email: 'ann@example.com', providers: [] }) =>
    renderToStaticMarkup(
      <MfaEnrollmentRequiredScreen
        api={api}
        subject={subject}
        labels={koAuthLabels}
        onEnrolled={() => undefined}
        onSignOut={() => undefined}
      />,
    )

  it('says what and why, with the start button and a way out as real buttons', () => {
    const out = screen()
    expect(out).toContain('2단계 인증을 켜 주세요')
    expect(out).toContain('role="dialog"')
    expect(out).toContain('aria-modal="true"')
    expect(out).toMatch(/<button[^>]*data-variant="primary"[^>]*>지금 켜기<\/button>/)
    expect(out).toMatch(/<button[^>]*data-variant="secondary"[^>]*>로그아웃<\/button>/)
  })

  it('draws a placeholder instead of the start button until the account is read, but the way out is always there', () => {
    const out = renderToStaticMarkup(
      <MfaEnrollmentRequiredScreen
        api={api}
        subject={null}
        labels={koAuthLabels}
        onEnrolled={() => undefined}
        onSignOut={() => undefined}
      />,
    )
    expect(out).not.toContain('지금 켜기')
    expect(out).toContain('로그아웃')
  })
})
