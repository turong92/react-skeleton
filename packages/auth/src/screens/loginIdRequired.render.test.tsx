import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createLoginIdRequiredController } from '../loginIdRequired'
import { koAuthLabels } from './labels.ko'
import { LoginIdGate } from './LoginIdGate'
import { LoginIdRequiredScreen } from './LoginIdRequiredScreen'

const html = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)
const noop = async () => undefined
const rules = { minLength: 4, maxLength: 20 }
const api = { checkLoginId: async () => ({ normalized: 'x', available: true }) }

const screen = (extra: Partial<React.ComponentProps<typeof LoginIdRequiredScreen>> = {}) =>
  html(
    <LoginIdRequiredScreen
      rules={rules}
      api={api}
      labels={koAuthLabels}
      onSubmit={noop}
      onChosen={() => undefined}
      onAlreadySet={() => undefined}
      onSignOut={() => undefined}
      {...extra}
    />,
  )

describe('LoginIdRequiredScreen (the full-screen "choose your username" step)', () => {
  it('says what and why in plain Korean, with one filled primary action', () => {
    const out = screen()
    expect(out).toContain('아이디를 정해 주세요')
    expect(out).toContain(
      '로그인할 때와 문의할 때 쓰는, 바뀌지 않는 내 계정 이름이에요. 다른 사람에게는 보이지 않아요.',
    )
    expect(out).toContain('role="dialog"')
    expect(out).toContain('aria-modal="true"')
    // 아이디 칸(라벨로 이어진다) + 안내 한 줄
    expect(out).toMatch(/<label[^>]*>아이디/)
    expect(out).toContain('autoComplete="username"')
    expect(out).toContain('4~20자')
    // 화면의 주 행동은 채워진 단추 하나 - 다른 단추는 테두리(로그아웃) · 위험(버리기)
    const submits = (out.match(/<button[^>]*type="submit"[^>]*>/g) ?? []).filter((b) =>
      b.includes('data-variant="primary"'),
    )
    expect(submits).toHaveLength(1)
    expect(out).toMatch(
      /<button[^>]*data-variant="primary"[^>]*type="submit"[^>]*>이 아이디로 정하기<\/button>|<button[^>]*type="submit"[^>]*data-variant="primary"[^>]*>이 아이디로 정하기<\/button>/,
    )
  })

  it('the ways out are a bordered "log out" button and an underlined "account settings" link', () => {
    const out = screen()
    expect(out).toMatch(/<button[^>]*data-variant="secondary"[^>]*>로그아웃<\/button>/)
    expect(out).toMatch(/<a [^>]*href="\/account"[^>]*>계정 설정<\/a>/)
    expect(out).toMatch(/<a [^>]*class="[^"]*link[^"]*"[^>]*href="\/account"/)
  })

  it('the settings link goes where the app says', () => {
    expect(screen({ settingsTo: '/me/account' })).toContain('href="/me/account"')
  })

  it('the confirmation dialog says it cannot be changed afterwards, with "set it" and "type again"', () => {
    const out = screen()
    expect(out).toContain('정한 뒤에는 바꿀 수 없어요.')
    expect(out).toContain('정하기')
    expect(out).toContain('다시 입력')
  })

  it('"already have an account?" is there only when the app gives the discard path', () => {
    expect(screen()).not.toContain('이미 계정이 있나요?')
    const out = screen({
      discard: {
        providers: ['kakao'],
        onDiscard: noop,
        onDiscarded: () => undefined,
      },
    })
    expect(out).toContain('이미 계정이 있나요?')
    expect(out).toMatch(
      /<button[^>]*data-variant="danger"[^>]*>이 계정 지우고 로그인 화면으로<\/button>/,
    )
    // 아이디를 아직 안 정했으니 확인 문구에 아이디 줄은 없다
    expect(out).not.toContain('다시 쓸 수 없어요')
  })

  it('reads in English by default', () => {
    const out = screen({ labels: undefined })
    expect(out).toContain('Choose your username')
    expect(out).toContain('Use this username')
  })
})

describe('LoginIdGate', () => {
  // 정적 렌더라 효과(`me` 읽기)는 돌지 않는다 - 게이트가 받는 모양만 맞춘 가짜
  const gateApi = {
    me: async () => ({ loginId: null }) as never,
    setLoginId: async () => ({}) as never,
    checkLoginId: api.checkLoginId,
    discardAccount: noop,
  }
  const gate = (controller = createLoginIdRequiredController(), standAside = false) =>
    html(
      <LoginIdGate
        controller={controller}
        api={gateApi}
        accountId="a"
        labels={koAuthLabels}
        standAside={standAside}
        onSignOut={() => undefined}
        onDiscarded={() => undefined}
      >
        <p>앱 화면</p>
      </LoginIdGate>,
    )

  it('shows only the app while nothing is required, and the app is not inert', () => {
    const out = gate()
    expect(out).toContain('앱 화면')
    expect(out).not.toContain('role="dialog"')
    expect(out).not.toContain('inert')
  })

  it('covers the app with the screen and makes the app inert once required', () => {
    const controller = createLoginIdRequiredController()
    controller.require()
    const out = gate(controller)
    expect(out).toContain('앱 화면')
    expect(out).toContain('inert')
    expect(out).toContain('아이디를 정해 주세요')
  })

  it('stands aside on the account page: the app stays alive and the screen is gone', () => {
    const controller = createLoginIdRequiredController()
    controller.require()
    const out = gate(controller, true)
    expect(out).toContain('앱 화면')
    expect(out).not.toContain('inert')
    expect(out).not.toContain('아이디를 정해 주세요')
  })
})
