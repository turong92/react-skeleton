import { ApiRequestError } from '@skeleton/api-client'
import { Button } from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ComponentProps } from 'react'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { useRequestRefund } from './hooks'
import { koPaymentLabels } from './labels'
import type { PaymentLedgerApi } from './ledgerApi'
import type { Refund } from './ledgerTypes'
import { RefundRequestDialog } from './RefundRequestDialog'
import { order, refund } from './test/fixtures'

/**
 * 환불 요청 확인 창 — 환불할 금액을 미리 보이고, 사유를 고르고(고정 셋: 마음이 바뀌었어요 · 같은 결제가 두 번 됐어요 · 받지 못했어요), 「환불 요청하기」/「닫기」.
 * 주 단추는 채운 「환불 요청하기」 하나. 닫는 단추는 「취소」가 아니라 「닫기」(「취소」는 결제 취소로 읽힌다). 처음 포커스는 「닫기」(실수로 Enter 를 눌러도 안전), 창 안에서 Tab 이 돈다(바깥으로 새지 않는다), Esc 로 닫힌다.
 * 요청이 실패하면 이유를 창 안에 띄운다(환불 중 · 지금은 안 됨 · 그 밖은 참조 번호와 함께). 「환불 중」 · 「지금은 안 됨」이면 확인 단추가 막힌다 — 꺼지지 않고 `aria-disabled` 로 흐리게(Tab 으로 닿고, 눌러도 아무 일 없고, 이유가 단추 설명으로 낭독된다. 다시 눌러도 같은 답).
 * 화면이 보인 금액(`refundableAmount`)을 요청의 `amount` 로 보낸다 — 그 사이 금액이 바뀌었으면 서버가 거절한다.
 */
const onConfirm = fn()
const onClose = fn()
const meta = {
  title: 'Packages/payment/RefundRequestDialog',
  component: RefundRequestDialog,
  args: {
    open: false,
    order: order(),
    onClose,
    onConfirm,
    labels: koPaymentLabels,
    locale: 'ko-KR',
  },
  beforeEach: () => {
    onConfirm.mockClear()
    onClose.mockClear()
  },
} satisfies Meta<typeof RefundRequestDialog>
export default meta
type Story = StoryObj<typeof meta>

function Demo(props: Partial<ComponentProps<typeof RefundRequestDialog>>) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        환불 요청
      </Button>
      <RefundRequestDialog
        {...(meta.args as ComponentProps<typeof RefundRequestDialog>)}
        {...props}
        open={open}
        onClose={() => {
          onClose()
          setOpen(false)
        }}
        onConfirm={(input) => {
          onConfirm(input)
          setOpen(false)
        }}
      />
    </>
  )
}

const dialogName = '환불을 요청할까요?'

export const ConfirmSendsTheChosenReason: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '환불 요청' }))
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: '닫기' })).toHaveFocus())
    await expect(dialog).toHaveTextContent('3,000원')
    const reason = within(dialog).getByLabelText('환불 사유')
    await expect(
      within(dialog)
        .getAllByRole('option')
        .map((o) => o.getAttribute('value')),
    ).toEqual(['CUSTOMER_REQUEST', 'DUPLICATE', 'NOT_DELIVERED'])
    await userEvent.selectOptions(reason, 'DUPLICATE')
    const confirm = within(dialog).getByRole('button', { name: '환불 요청하기' })
    await expect(confirm).toHaveAttribute('data-variant', 'primary')
    await userEvent.click(confirm)
    // 창이 보인 금액을 그대로 요청한다
    await expect(onConfirm).toHaveBeenCalledWith({ reasonCode: 'DUPLICATE', amount: 3000 })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  },
}

export const CloseSendsNothing: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '환불 요청' }))
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await userEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
    await expect(onConfirm).not.toHaveBeenCalled()
    await expect(onClose).toHaveBeenCalled()
    // 연 단추로 포커스가 돌아온다
    await waitFor(() => expect(canvas.getByRole('button', { name: '환불 요청' })).toHaveFocus())
  },
}

export const OpensAsAModalWithFocusInside: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '환불 요청' }))
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    // 포커스 가둠은 브라우저의 모달 `<dialog>` 몫이다 — 합성 Tab 은 그것을 흉내 내지 못하니 모달인지와 포커스가 안에 있는지를 본다
    await expect(dialog.matches(':modal')).toBe(true)
    await expect(dialog.contains(document.activeElement)).toBe(true)
  },
}

export const EscapeCloses: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '환불 요청' }))
    const dialog = (await screen.findByRole('dialog', { name: dialogName })) as HTMLDialogElement
    dialog.requestClose() // 합성 키 입력이 못 하는 브라우저 몫 — Esc 와 같은 경로
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(onConfirm).not.toHaveBeenCalled()
  },
}

export const Busy: Story = {
  args: { open: true, busy: true },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await expect(within(dialog).getByRole('button', { name: '닫기' })).toBeDisabled()
    const confirm = within(dialog).getByRole('button', { name: /환불 요청하기/ })
    await expect(confirm).toBeDisabled()
    // 일하는 중의 스피너도 한국어로 읽힌다
    await expect(confirm).toHaveAccessibleName('요청하는 중 환불 요청하기')
    await expect(within(dialog).queryByText('Loading')).toBeNull()
  },
}

async function expectBlockedButReachable(dialog: HTMLElement, reason: string) {
  const confirm = within(dialog).getByRole('button', { name: '환불 요청하기' })
  await expect(confirm).toHaveAttribute('aria-disabled', 'true')
  await expect(confirm).not.toBeDisabled()
  await expect(confirm).toHaveAccessibleDescription(expect.stringContaining(reason))
  // 눌러도 아무 일 없고, Tab 으로 닿는다
  await userEvent.click(confirm)
  await expect(onConfirm).not.toHaveBeenCalled()
  confirm.focus()
  await expect(confirm).toHaveFocus()
}

const failure = (code: string) =>
  new ApiRequestError(
    { code, title: 't', status: 409, timestamp: '2026-01-01T00:00:00Z', traceId: 'trace-7' },
    'trace-7',
    'sp',
    'tp',
  )

export const ErrorRefundAlreadyOpen: Story = {
  args: { open: true, error: failure('PAYMENT.REFUND_IN_PROGRESS') },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    const alert = within(dialog).getByRole('alert')
    await expect(alert).toHaveTextContent('환불 중이에요')
    await expect(alert).toHaveTextContent('오류') // 낭독 말머리도 한국어
    // 막혔지만 닿는다: 꺼지지(disabled) 않고 aria-disabled, 이유가 단추 설명으로 이어진다
    await expectBlockedButReachable(dialog, '환불 중이에요')
  },
}

export const ErrorRefundNotAllowed: Story = {
  args: { open: true, error: failure('PAYMENT.REFUND_NOT_ALLOWED') },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await expect(within(dialog).getByRole('alert')).toHaveTextContent(
      '지금은 환불을 요청할 수 없어요',
    )
    // 막혔지만 닿는다: 꺼지지(disabled) 않고 aria-disabled, 이유가 단추 설명으로 이어진다
    await expectBlockedButReachable(dialog, '지금은 환불을 요청할 수 없어요')
  },
}

export const NothingLeftToRefund: Story = {
  args: { open: true, order: order({ refundableAmount: 0 }) },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await expect(within(dialog).getByText('환불할 수 있는 금액이 없어요')).toBeVisible()
    // 막혔지만 닿는다: 꺼지지(disabled) 않고 aria-disabled, 이유가 단추 설명으로 이어진다
    await expectBlockedButReachable(dialog, '환불할 수 있는 금액이 없어요')
  },
}

export const ErrorOtherShowsReference: Story = {
  args: { open: true, error: failure('COMMON.INTERNAL') },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await expect(within(dialog).getByRole('alert')).toHaveTextContent('환불을 요청하지 못했어요')
    // 다른 오류는 다시 눌러 볼 수 있다
    await expect(within(dialog).getByRole('button', { name: '환불 요청하기' })).toBeEnabled()
    await expect(within(dialog).getByText('trace-7')).toBeVisible()
  },
}

/**
 * 훅 연결의 정본 — 요청이 실패하면(여기서는 첫 번째 네트워크 오류) 이유가 창 안에 뜨고, 다시 누르면 **같은 `Idempotency-Key`** 로 나간다.
 * 사이에 화면이 여러 번 다시 그려졌다(보내는 중 → 오류) — 키를 훅이 들고 있다는 뜻이다. 열 때마다 `request.reset()` 으로 묵은 오류를 지운다.
 */
const sentKeys: Array<string | undefined> = []
let sentCount = 0
const flakyApi = {
  requestRefund: async (
    _orderId: string,
    _input: unknown,
    options?: { idempotencyKey?: string },
  ): Promise<Refund> => {
    sentKeys.push(options?.idempotencyKey)
    if (++sentCount === 1) throw new Error('network')
    return refund()
  },
} as unknown as PaymentLedgerApi

function WiredDialog() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { mutations: { retry: false } } }),
  )
  return (
    <QueryClientProvider client={client}>
      <Wired />
    </QueryClientProvider>
  )
}

function Wired() {
  const [open, setOpen] = useState(true)
  const request = useRequestRefund(flakyApi)
  return (
    <RefundRequestDialog
      open={open}
      order={order()}
      onClose={() => setOpen(false)}
      onConfirm={({ reasonCode, amount }) =>
        request.mutate(
          { orderId: 'ord_1', reasonCode, ...(amount !== undefined ? { amount } : {}) },
          { onSuccess: () => setOpen(false) },
        )
      }
      busy={request.isPending}
      error={request.error}
      labels={koPaymentLabels}
      locale="ko-KR"
    />
  )
}

export const RetryAfterAFailureKeepsTheSameKey: Story = {
  beforeEach: () => {
    sentKeys.length = 0
    sentCount = 0
  },
  render: () => <WiredDialog />,
  play: async ({ userEvent }) => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await userEvent.click(within(dialog).getByRole('button', { name: '환불 요청하기' }))
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '환불을 요청하지 못했어요',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '환불 요청하기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(sentKeys).toHaveLength(2)
    await expect(sentKeys[0]).toMatch(/^fe-/)
    await expect(sentKeys[1]).toBe(sentKeys[0])
  },
}

export const English: Story = {
  args: { open: true, labels: undefined, locale: 'en-US' },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: 'Request a refund?' })
    await expect(within(dialog).getByRole('button', { name: 'Request refund' })).toBeVisible()
    await expect(within(dialog).getByRole('button', { name: 'Close' })).toBeVisible()
  },
}

/**
 * 320px · 375px — 모달은 뷰포트에 붙으니 틀 안에 가두지 않고 뷰포트 자체를 바꾼다(`globals.viewport`).
 * 사유 선택 · 오류 · 참조 번호까지 다 띄운 가장 긴 모양이 가로로 밀리지 않는다.
 */
const viewports = {
  options: {
    w320: { name: '320px', styles: { width: '320px', height: '640px' } },
    w375: { name: '375px', styles: { width: '375px', height: '700px' } },
  },
}

async function expectNoSidewaysScroll(width: number) {
  const dialog = await screen.findByRole('dialog')
  await expect(window.innerWidth).toBe(width)
  await expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth)
  await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  await expect(dialog.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth)
}

const longError = new ApiRequestError(
  {
    code: 'COMMON.INTERNAL',
    title: 't',
    status: 500,
    timestamp: '2026-01-01T00:00:00Z',
    traceId: 'trace-'.concat('0123456789abcdef'.repeat(4)),
  },
  'trace-'.concat('0123456789abcdef'.repeat(4)),
  'sp',
  'tp',
)

export const At320: Story = {
  parameters: { viewport: viewports },
  globals: { viewport: { value: 'w320', isRotated: false } },
  args: { open: true, error: longError },
  play: () => expectNoSidewaysScroll(320),
}

export const At375: Story = {
  parameters: { viewport: viewports },
  globals: { viewport: { value: 'w375', isRotated: false } },
  args: { open: true, error: longError },
  play: () => expectNoSidewaysScroll(375),
}

export const EnglishAt320: Story = {
  parameters: { viewport: viewports },
  globals: { viewport: { value: 'w320', isRotated: false } },
  args: { open: true, labels: undefined, locale: 'en-US', error: longError },
  play: () => expectNoSidewaysScroll(320),
}
