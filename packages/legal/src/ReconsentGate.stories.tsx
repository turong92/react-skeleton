import { ApiRequestError, type ForbiddenContext } from '@skeleton/api-client'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useState } from 'react'
import { expect, fn, screen, waitFor, within } from 'storybook/test'
import { koLegalLabels } from './labels'
import { createReconsentController } from './reconsent'
import { ReconsentGate } from './ReconsentGate'
import { createFakeLegalApi, type FakeLegalOptions } from './stories/fakeLegalApi'
import { WithQuery } from './stories/WithQuery'

/**
 * 재동의 — 새 판이 시행됐거나(403 `LEGAL.RECONSENT_REQUIRED`), 소셜 · 링크로 처음 들어와 동의가 없을 때(로그인 직후 `blocked`) 앱 위를 덮는 화면.
 * 뒤의 화면은 `inert` 로 살아 있어, 동의가 끝나면 막혔던 호출이 다시 나가 가던 자리에서 이어진다.
 */
function Demo({
  fake,
  accountId = null,
  onLeave,
  trigger,
}: {
  fake?: FakeLegalOptions
  accountId?: string | null
  onLeave?: () => void
  /** 403 을 받는 호출을 흉내 내는 버튼 — 눌러서 `recover` 가 풀리면 「이어졌다」가 뜬다 */
  trigger?: Array<{ type: string; version: string; reason: 'NOT_AGREED' | 'STALE' }>
}) {
  const api = useMemo(() => createFakeLegalApi(fake), [fake])
  ;(window as unknown as { __legalCalls: string[] }).__legalCalls = api.calls
  const controller = useMemo(() => createReconsentController({ api }), [api])
  const [result, setResult] = useState('')
  async function call() {
    const error = new ApiRequestError(
      {
        code: 'LEGAL.RECONSENT_REQUIRED',
        title: 'x',
        status: 403,
        timestamp: 't',
        data: { missing: trigger },
      },
      't',
      's',
      'p',
    )
    const context: ForbiddenContext = { error, path: '/notes', method: 'GET' }
    setResult((await controller.recover(context)) ? '이어졌다' : '403 그대로')
  }
  return (
    <WithQuery>
      <ReconsentGate
        controller={controller}
        api={api}
        accountId={accountId}
        onLeave={onLeave ?? (() => undefined)}
        locale="ko"
        labels={koLegalLabels}
      >
        <main>
          <h1>내 노트</h1>
          <button type="button" onClick={() => void call()}>
            노트 불러오기
          </button>
          <output>{result}</output>
        </main>
      </ReconsentGate>
    </WithQuery>
  )
}

const meta = {
  title: 'Packages/Legal/Re-consent',
  component: Demo,
  args: { onLeave: fn() },
} satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof meta>

export const FirstSignInWithoutConsent: Story = {
  args: { fake: { blocked: true }, accountId: 'acc-1' },
  play: async ({ canvas, userEvent }) => {
    // 한 번도 동의한 적이 없다(모두 NOT_AGREED) — 「약관이 바뀌었어요」가 아니라 처음 동의 문구
    const dialog = await screen.findByRole('dialog', { name: '약관 동의' })
    await expect(within(dialog).getByText(/계속하기 전에/)).toBeVisible()
    // 뒤 화면은 inert — 키보드 · 낭독에서 빠진다(살아 있어서 동의 뒤 그 자리에서 이어진다)
    await expect(canvas.getByRole('heading', { name: '내 노트' }).closest('[inert]')).not.toBeNull()
    // 체크 없이는 못 간다
    await userEvent.click(within(dialog).getByRole('button', { name: '동의하고 계속하기' }))
    await expect(within(dialog).getAllByText('필수 항목에 동의해 주세요.').length).toBe(2)
    await userEvent.click(within(dialog).getByRole('checkbox', { name: '전체 동의' }))
    await userEvent.click(within(dialog).getByRole('button', { name: '동의하고 계속하기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(canvas.getByRole('button', { name: '노트 불러오기' })).toBeVisible()
  },
}

export const NothingMissingShowsNothing: Story = {
  args: { fake: {}, accountId: 'acc-1' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: '내 노트' })).toBeVisible()
    await expect(screen.queryByRole('dialog')).toBeNull()
  },
}

/** 막이 열려 있지 않은 동안은 문서 목록을 묻지 않는다 — legal 모듈이 없는 백엔드에 모든 화면이 쓸데없이 묻지 않게 */
export const IdleGateDoesNotFetchDocuments: Story = {
  args: { fake: {}, accountId: 'acc-1' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: '내 노트' })).toBeVisible()
    const calls = (window as unknown as { __legalCalls: string[] }).__legalCalls
    await waitFor(() => expect(calls).toContain('myConsents')) // 로그인 확인은 한다
    await expect(calls).not.toContain('documents')
  },
}

export const ForbiddenCallResumesAfterTheAgreement: Story = {
  args: {
    fake: {},
    accountId: 'acc-1',
    trigger: [{ type: 'terms', version: '2026-10-01', reason: 'STALE' }],
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '노트 불러오기' }))
    const dialog = await screen.findByRole('dialog', { name: '약관이 바뀌었어요' })
    await expect(within(dialog).getByText(/바뀐 문서를 읽고/)).toBeVisible() // 쓰다가 바뀐 경우의 문구
    await expect(within(dialog).queryByRole('checkbox', { name: /개인정보/ })).toBeNull() // 서버가 말한 문서만 묻는다
    await userEvent.click(within(dialog).getByRole('button', { name: '이용약관 보기' }))
    await expect(await screen.findByRole('dialog', { name: '이용약관' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /이용약관/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: '동의하고 계속하기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(await canvas.findByText('이어졌다')).toBeVisible() // 막혔던 호출이 풀렸다(api-client 가 다시 보낸다)
  },
}

export const LeavingKeepsThe403: Story = {
  args: {
    fake: {},
    accountId: 'acc-1',
    trigger: [{ type: 'terms', version: '2026-10-01', reason: 'NOT_AGREED' }],
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '노트 불러오기' }))
    const dialog = await screen.findByRole('dialog', { name: '약관 동의' })
    await userEvent.click(within(dialog).getByRole('button', { name: '로그아웃' }))
    await expect(args.onLeave).toHaveBeenCalled()
    await expect(await canvas.findByText('403 그대로')).toBeVisible()
  },
}

export const NewerVersionPublishedMeanwhile: Story = {
  args: {
    fake: { staleFirstAgree: true },
    accountId: null,
    trigger: [{ type: 'terms', version: '2026-10-01', reason: 'STALE' }],
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '노트 불러오기' }))
    const first = await screen.findByRole('dialog', { name: '약관이 바뀌었어요' })
    await userEvent.click(within(first).getByRole('checkbox', { name: /이용약관/ }))
    await userEvent.click(within(first).getByRole('button', { name: '동의하고 계속하기' }))
    // 409 → 목록을 새로 읽고 새 판으로 다시 묻는다(줄이 바뀌어 화면이 새로 선다 — 체크도 처음부터)
    const again = await screen.findByText(/방금 새 판이 나왔어요/)
    await expect(again).toBeVisible()
    const dialog = screen.getByRole('dialog', { name: '약관이 바뀌었어요' })
    await expect(within(dialog).getByRole('checkbox', { name: /이용약관/ })).not.toBeChecked() // 새 판이라 체크는 처음부터
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /이용약관/ }))
    await expect(within(dialog).getByRole('checkbox', { name: /이용약관/ })).toBeChecked()
    await userEvent.click(within(dialog).getByRole('button', { name: '동의하고 계속하기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  },
}
