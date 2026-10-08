import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createEmailRequiredController } from '../emailRequired'
import { EmailRequiredGate } from './EmailRequiredGate'
import { ReauthPrompt } from './EmailRequiredParts'
import { EmailRequiredScreen } from './EmailRequiredScreen'
import { EmailWriteNotice } from './EmailWriteNotice'
import { koAuthLabels } from './labels.ko'

const html = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)
const noop = async () => undefined

const screen = (extra: Partial<React.ComponentProps<typeof EmailRequiredScreen>> = {}) =>
  html(
    <EmailRequiredScreen
      providers={['kakao']}
      labels={koAuthLabels}
      onRequestCode={noop}
      onConfirmCode={noop}
      onRegistered={() => undefined}
      onSignOut={() => undefined}
      onDiscard={noop}
      onDiscarded={() => undefined}
      {...extra}
    />,
  )

describe('EmailRequiredScreen, the write look', () => {
  it('says it is about writing, and has a bordered "not now" button next to sign out', () => {
    const out = screen({ variant: 'write', onLater: () => undefined })
    expect(out).toContain('글을 쓰려면 이메일을 등록해 주세요')
    expect(out).toContain('읽기는 지금처럼 할 수 있어요')
    expect(out).not.toContain('>이메일을 등록해 주세요</h1>')
    expect(out).toMatch(/<button[^>]*data-variant="secondary"[^>]*>나중에 하기<\/button>/)
    expect(out).toMatch(/<button[^>]*data-variant="secondary"[^>]*>로그아웃<\/button>/)
    // still exactly one filled button
    expect(out.match(/data-variant="primary"/g)).toHaveLength(1)
  })

  it('the sign-in look has no "not now" (as it is today)', () => {
    const out = screen({ onLater: () => undefined })
    expect(out).toContain('이메일을 등록해 주세요')
    expect(out).not.toContain('나중에 하기')
    expect(screen({ variant: 'login' })).not.toContain('나중에 하기')
  })

  it('carries the username into the discard confirmation only when there is one (prop reaches DiscardPath)', () => {
    // the confirmation is closed in a static render; the prop's job is covered by the story - here only that it is accepted
    expect(() =>
      screen({ variant: 'write', onLater: () => undefined, loginId: 'sumin.kim' }),
    ).not.toThrow()
  })
})

describe('ReauthPrompt: leaving for the provider in the write look', () => {
  const prompt = (losesDraft?: boolean) =>
    html(
      <ReauthPrompt
        labels={koAuthLabels}
        providers={['kakao']}
        canContinue
        losesDraft={losesDraft}
        onProvider={() => undefined}
        onRetry={() => undefined}
      />,
    )
  it('warns that what they were writing is gone', () => {
    expect(prompt(true)).toContain('카카오(으)로 다녀오면 지금 쓰던 내용은 사라져요.')
  })
  it('says nothing about it in the sign-in look', () => {
    expect(prompt()).not.toContain('사라져요')
  })
})

describe('EmailRequiredGate picks the look from what the server asks for', () => {
  const api = {
    me: async () => ({ emailRequired: false, emailRequiredToWrite: true }) as never,
    changeEmail: noop,
    confirmEmailChangeCode: noop,
    discardAccount: noop,
  }
  const gate = (when: 'unknown' | 'none' | 'login' | 'write') => {
    const controller = createEmailRequiredController()
    controller.setWhen(when)
    controller.require()
    return html(
      <EmailRequiredGate
        controller={controller}
        api={api}
        accountId="a"
        labels={koAuthLabels}
        onSignOut={() => undefined}
        onDiscarded={() => undefined}
      >
        <p>앱 화면</p>
      </EmailRequiredGate>,
    )
  }
  it('write → the write look with "not now"', () => {
    const out = gate('write')
    expect(out).toContain('글을 쓰려면 이메일을 등록해 주세요')
    expect(out).toContain('나중에 하기')
  })
  it.each(['unknown', 'none', 'login'] as const)('%s → the sign-in look, no "not now"', (when) => {
    const out = gate(when)
    expect(out).toContain('이메일을 등록해 주세요')
    expect(out).not.toContain('나중에 하기')
  })
})

describe('EmailWriteNotice (the strip above a comment box)', () => {
  const notice = (when: 'unknown' | 'none' | 'login' | 'write') => {
    const controller = createEmailRequiredController()
    controller.setWhen(when)
    return html(<EmailWriteNotice controller={controller} labels={koAuthLabels} />)
  }
  it('says why and has a bordered button, in write mode only', () => {
    const out = notice('write')
    expect(out).toContain('이메일을 등록하면 글을 쓸 수 있어요')
    expect(out).toMatch(/<button[^>]*data-variant="secondary"[^>]*>이메일 등록<\/button>/)
  })
  it.each(['unknown', 'none', 'login'] as const)('%s → nothing is drawn', (when) => {
    expect(notice(when)).toBe('')
  })
})
