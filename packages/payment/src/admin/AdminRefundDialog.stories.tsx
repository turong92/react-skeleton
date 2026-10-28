import { ApiRequestError } from '@skeleton/api-client'
import { Button } from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ComponentProps } from 'react'
import { expect, fn, screen, waitFor, within } from 'storybook/test'
import { koPaymentLabels } from '../labels'
import type { Refund } from '../ledgerTypes'
import { adminOrder, adminRefund, order } from '../test/fixtures'
import type { PaymentAdminApi } from './adminApi'
import { useOperatorRefund, useSyncOrder } from './adminHooks'
import { AdminOrderPanel } from './AdminOrderPanel'
import { AdminRefundDialog } from './AdminRefundDialog'
import { RefundNotDoneError } from './refundOutcome'
import type { AdminRefund } from './types'
import { heldSecondsOf, useDirectRefund } from './useDirectRefund'
import { useRefundDecision } from './useRefundDecision'

/**
 * 운영자의 환불 결정 창 — 돈이 나가는 행동(직접 환불 · 요청대로 환불)은 늘 이 창을 거친다. 세 가지 모양:
 * `direct` 금액(전액이 처음 값, 부분은 고쳐 쓴다)과 사유를 정해 바로 환불 / `approve` 본인의 요청을 요청한 금액 그대로 환불 / `reject` 요청을 거절(돈은 안 나간다).
 * 금액은 남은 금액을 넘지 못하게 화면에서도 막는다(서버가 최종 판단). 못 누르는 확인은 꺼지지 않고 `aria-disabled` 로 흐리게 — Tab 으로 닿고 이유가 단추 설명으로 낭독된다.
 * 서버의 답은 **확정과 모름을 가른다**: 답을 잃었으면(네트워크 오류 · 시간 초과 · 5xx) 「환불 결과를 확인하지 못했어요」와 환불 내역 확인 안내이고 확인은 열려 있다(같은 키로 다시 보내도 된다),
 * 장부 코드(`PAYMENT.*`)가 붙은 답 - 결제사 거절 · 409 · 400 · 503 `PAYMENT.UNAVAILABLE`(보내기 전 확인 조회 실패 — 아무것도 안 나갔다) - 만 확정이라(코드 없는 4xx · `PROVIDER_NOT_FOUND` · `ROUTING_FAILED` 는 모름) 각자의 말로 하고 다음 누름은 새 키다.
 * 요청 승인이 결제사에 거절되면(402) 그 요청 줄은 환불 안 됨으로 닫히니 확인이 막히고 「결제 한 건에서 직접 환불해 주세요」로 안내한다.
 * 처음 포커스는 — 직접 환불은 금액 칸(Enter 로 제출되지 않는다), 요청 처리는 「닫기」(실수로 Enter 를 눌러도 안전) — 닫는 말은 「취소」가 아니라 「닫기」. 열 때마다 처음 모습(전액 · 운영자 사유)으로 돌아온다 - **일하는 중이거나 끝난 오류가 남아 있으면 빼고**: 보내는 중과 모름에서는 금액 · 사유 칸이 잠기고(읽기 전용이되 닿는다) **보낸 값**이 그대로 보인다(다른 값을 보내면 새 키라 이미 나간 부분 환불이 한 번 더 나간다).
 */
const onConfirm = fn()
const onClose = fn()
const meta = {
  title: 'Packages/payment/admin/AdminRefundDialog',
  component: AdminRefundDialog,
  args: {
    open: false,
    mode: 'direct',
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
} satisfies Meta<typeof AdminRefundDialog>
export default meta
type Story = StoryObj<typeof meta>

const failure = (code: string, status = 409, data?: unknown) =>
  new ApiRequestError(
    { code, title: 't', status, timestamp: 't', traceId: 'trace-7', data },
    'trace-7',
    'sp',
    'tp',
  )

/** 열고 닫는 틀 — 열기 단추는 창 밖에 있고, 닫으면 포커스가 거기로 돌아온다 */
function Demo(props: Partial<ComponentProps<typeof AdminRefundDialog>>) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        열기
      </Button>
      <AdminRefundDialog
        {...(meta.args as ComponentProps<typeof AdminRefundDialog>)}
        {...(props as object)}
        open={open}
        onClose={() => {
          onClose()
          setOpen(false)
        }}
        onConfirm={(input?: unknown) => {
          ;(onConfirm as (input?: unknown) => void)(input)
          setOpen(false)
        }}
      />
    </>
  )
}

const directName = '환불할까요?'

/** 눌리는 모양인가 - 쉬는 상태에서도 테두리와 바탕이 있고 밑줄이 아니다(날 `<a>` 는 `base.css` 에서 본문 글자가 된다) */
async function expectButtonLike(link: HTMLElement) {
  await expect(link).toBeVisible()
  const style = getComputedStyle(link)
  await expect(style.borderTopWidth).toBe('1px')
  await expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  await expect(style.textDecorationLine).toBe('none')
  await expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(36)
}

async function expectBlockedButReachable(dialog: HTMLElement, reason: string | RegExp) {
  const confirm = within(dialog).getByRole('button', { name: '환불하기' })
  await expect(confirm).toHaveAttribute('aria-disabled', 'true')
  await expect(confirm).not.toBeDisabled()
  await expect(confirm).toHaveAccessibleDescription(
    typeof reason === 'string' ? expect.stringContaining(reason) : reason,
  )
}

export const FullRefundIsTheStart: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '열기' }))
    const dialog = await screen.findByRole('dialog', { name: directName })
    // 처음 포커스는 금액 칸 — 지울 것은 없고(Enter 로 제출되지 않는다) 곧바로 고쳐 쓸 수 있다. 요청 처리 창은 「닫기」에서 시작한다
    await waitFor(() => expect(within(dialog).getByLabelText('환불할 금액')).toHaveFocus())
    await expect(within(dialog).getByLabelText('환불할 금액')).toHaveValue('3000')
    await expect(dialog).toHaveTextContent('환불할 수 있는 금액: 3,000원')
    await expect(
      within(dialog)
        .getAllByRole('option')
        .map((o) => o.getAttribute('value')),
    ).toEqual(['OPERATOR', 'CUSTOMER_REQUEST', 'DUPLICATE', 'NOT_DELIVERED'])
    const confirm = within(dialog).getByRole('button', { name: '환불하기' })
    await expect(confirm).toHaveAttribute('data-variant', 'danger')
    await userEvent.click(confirm)
    await expect(onConfirm).toHaveBeenCalledWith({ reasonCode: 'OPERATOR', amount: 3000 })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  },
}

export const PartialRefundSendsTheTypedAmountAndReason: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '열기' }))
    const dialog = await screen.findByRole('dialog', { name: directName })
    const amount = within(dialog).getByLabelText('환불할 금액')
    await userEvent.clear(amount)
    await userEvent.type(amount, '1,000')
    await userEvent.selectOptions(within(dialog).getByLabelText('환불 사유'), 'DUPLICATE')
    await userEvent.click(within(dialog).getByRole('button', { name: '환불하기' }))
    await expect(onConfirm).toHaveBeenCalledWith({ reasonCode: 'DUPLICATE', amount: 1000 })
  },
}

/** 남은 금액을 넘는 금액은 화면에서 막는다 — 고치면 풀린다. 이유는 칸 아래 글자이자 확인 단추의 설명 */
export const AnAmountOverWhatIsLeftIsBlocked: Story = {
  render: () => <Demo order={order({ refundableAmount: 2500 })} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '열기' }))
    const dialog = await screen.findByRole('dialog', { name: directName })
    const amount = within(dialog).getByLabelText('환불할 금액')
    await userEvent.clear(amount)
    await userEvent.type(amount, '2501')
    await expect(amount).toHaveAttribute('aria-invalid', 'true')
    await expectBlockedButReachable(dialog, '환불할 수 있는 금액(2,500원)을 넘을 수 없어요')
    await userEvent.click(within(dialog).getByRole('button', { name: '환불하기' }))
    await expect(onConfirm).not.toHaveBeenCalled() // 눌러도 아무 일 없다
    await userEvent.clear(amount)
    await userEvent.type(amount, '2500')
    await expect(within(dialog).getByRole('button', { name: '환불하기' })).not.toHaveAttribute(
      'aria-disabled',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '환불하기' }))
    await expect(onConfirm).toHaveBeenCalledWith({ reasonCode: 'OPERATOR', amount: 2500 })
  },
}

export const TextThatIsNotAnAmountIsBlocked: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '열기' }))
    const dialog = await screen.findByRole('dialog', { name: directName })
    const amount = within(dialog).getByLabelText('환불할 금액')
    const cases: Array<[string, string]> = [
      ['', '환불할 금액을 적어 주세요'],
      ['abc', '숫자로 적어 주세요'],
      ['-5', '숫자로 적어 주세요'],
      ['1.5', '숫자로 적어 주세요'],
      ['0', '0보다 큰 금액을 적어 주세요'],
    ]
    for (const [typed, reason] of cases) {
      await userEvent.clear(amount)
      if (typed) await userEvent.type(amount, typed)
      await expectBlockedButReachable(dialog, reason)
    }
    await expect(onConfirm).not.toHaveBeenCalled()
  },
}

export const NothingLeftToRefund: Story = {
  args: { open: true, order: order({ refundableAmount: 0 }) },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: directName })
    await expect(within(dialog).getByText('환불할 수 있는 금액이 없어요')).toBeVisible()
    await expectBlockedButReachable(dialog, '환불할 수 있는 금액이 없어요')
  },
}

export const CloseSendsNothingAndReturnsFocus: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '열기' }))
    const dialog = await screen.findByRole('dialog', { name: directName })
    await userEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
    await expect(onConfirm).not.toHaveBeenCalled()
    await expect(onClose).toHaveBeenCalled()
    await waitFor(() => expect(canvas.getByRole('button', { name: '열기' })).toHaveFocus())
  },
}

export const EscapeCloses: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '열기' }))
    const dialog = (await screen.findByRole('dialog', { name: directName })) as HTMLDialogElement
    dialog.requestClose() // 합성 키 입력이 못 하는 브라우저 몫 — Esc 와 같은 경로
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(onConfirm).not.toHaveBeenCalled()
  },
}

/** 열 때마다 처음으로 — 지난번에 고쳐 쓴 금액과 사유가 남아 있지 않다 */
export const OpensAgainFromTheStart: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '열기' }))
    let dialog = await screen.findByRole('dialog', { name: directName })
    const amount = within(dialog).getByLabelText('환불할 금액')
    await userEvent.clear(amount)
    await userEvent.type(amount, '100')
    await userEvent.selectOptions(within(dialog).getByLabelText('환불 사유'), 'NOT_DELIVERED')
    await userEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await userEvent.click(canvas.getByRole('button', { name: '열기' }))
    dialog = await screen.findByRole('dialog', { name: directName })
    await expect(within(dialog).getByLabelText('환불할 금액')).toHaveValue('3000')
    await expect(within(dialog).getByLabelText('환불 사유')).toHaveValue('OPERATOR')
  },
}

export const Busy: Story = {
  args: { open: true, busy: true },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: directName })
    await expect(within(dialog).getByRole('button', { name: '닫기' })).toBeDisabled()
    const confirm = within(dialog).getByRole('button', { name: /환불하기/ })
    await expect(confirm).toBeDisabled() // 정말 일하는 중일 때만 disabled
    await expect(confirm).toHaveAccessibleName('환불하는 중 환불하기')
    await expect(within(dialog).queryByText('Loading')).toBeNull()
  },
}

/** 결제사가 거절하면 이유를 종류별 말로 — 결제사 코드는 참조 번호 안에만. 다시 눌러 볼 수 있다 */
export const ProviderRefusedByCategory: Story = {
  args: {
    open: true,
    error: failure('PAYMENT.REFUND_DECLINED', 402, {
      category: 'ALREADY_REFUNDED',
      providerCode: 'ALREADY_CANCELED_PAYMENT',
    }),
  },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: directName })
    await expect(within(dialog).getByRole('alert')).toHaveTextContent(
      '결제사에서 이미 환불된 결제예요. 「결제사와 맞추기」로 장부를 맞춰 주세요',
    )
    await expect(within(dialog).getByText('trace-7 / ALREADY_CANCELED_PAYMENT')).toBeVisible()
    await expect(within(dialog).getByRole('button', { name: '환불하기' })).toBeEnabled()
    await expect(within(dialog).getByRole('button', { name: '환불하기' })).not.toHaveAttribute(
      'aria-disabled',
    )
  },
}

export const ErrorRefundInProgress: Story = {
  args: { open: true, error: failure('PAYMENT.REFUND_IN_PROGRESS') },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: directName })
    await expect(within(dialog).getByRole('alert')).toHaveTextContent('환불 중이에요')
    await expectBlockedButReachable(dialog, '환불 중이에요')
  },
}

export const ErrorNotAllowed: Story = {
  args: { open: true, error: failure('PAYMENT.REFUND_NOT_ALLOWED') },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: directName })
    await expectBlockedButReachable(dialog, '지금은 환불할 수 없어요')
  },
}

export const ErrorAmountChanged: Story = {
  args: { open: true, error: failure('PAYMENT.REFUND_AMOUNT_EXCEEDED', 400) },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: directName })
    await expectBlockedButReachable(dialog, '환불할 수 있는 금액이 바뀌었어요')
  },
}

/** 답을 잃었다 - 환불이 나갔는지 모른다. 「못 했어요」라고 단정하지 않고, 어디서 확인하는지 말한다. 같은 키로 다시 보내도 되니 확인은 열려 있다 */
export const ErrorUnknownSaysTheResultIsUnknown: Story = {
  args: { open: true, error: failure('COMMON.INTERNAL', 500) },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: directName })
    await expect(within(dialog).getByRole('alert')).toHaveTextContent(
      '환불 결과를 확인하지 못했어요. 환불 내역에서 나갔는지 확인해 주세요. 나가지 않았다면 같은 내용으로 다시 보낼 수 있어요',
    )
    await expect(within(dialog).getByRole('alert')).not.toHaveTextContent('환불하지 못했어요')
    await expect(within(dialog).getByRole('button', { name: '환불하기' })).toBeEnabled()
    await expect(within(dialog).getByRole('button', { name: '환불하기' })).not.toHaveAttribute(
      'aria-disabled',
    )
    await expect(within(dialog).getByText('trace-7')).toBeVisible()
  },
}

/** 보내기 전 확인 조회가 실패해 보내지 않았다(503) - 모름이 아니라 확정이다. 조금 뒤에 다시 */
export const ErrorUnavailableNothingWasSent: Story = {
  args: { open: true, error: failure('PAYMENT.UNAVAILABLE', 503) },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: directName })
    await expect(within(dialog).getByRole('alert')).toHaveTextContent(
      '지금은 환불을 보낼 수 없어요. 조금 뒤에 다시 해 보세요',
    )
    await expect(within(dialog).getByRole('button', { name: '환불하기' })).not.toHaveAttribute(
      'aria-disabled',
    )
  },
}

/** 서버가 요청의 모양을 선점 전에 거절했다(400 `COMMON.VALIDATION_FAILED` 등) - 아무것도 나가지 않았다: 「확인하지 못했어요」가 아니라 올바르지 않다고 말하고 칸은 열려 있다 */
export const ErrorInvalidRequestNothingWentOut: Story = {
  args: { open: true, error: failure('COMMON.VALIDATION_FAILED', 400) },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: directName })
    await expect(within(dialog).getByRole('alert')).toHaveTextContent(
      '보낸 내용이 올바르지 않아요. 금액과 사유를 확인하고 다시 해 보세요',
    )
    await expect(within(dialog).getByLabelText('환불할 금액')).not.toHaveAttribute('readonly')
    await expect(within(dialog).getByRole('button', { name: '환불하기' })).not.toHaveAttribute(
      'aria-disabled',
    )
  },
}

export const ErrorOtherConfirmed: Story = {
  args: { open: true, error: failure('PAYMENT.ORDER_NOT_FOUND', 404) },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: directName })
    await expect(within(dialog).getByRole('alert')).toHaveTextContent('환불하지 못했어요')
    await expect(within(dialog).getByRole('button', { name: '환불하기' })).toBeEnabled()
    await expect(within(dialog).getByText('trace-7')).toBeVisible()
  },
}

export const ErrorRefundLineClosedWithoutRefunding: Story = {
  args: { open: true, error: new RefundNotDoneError(adminRefund({ status: 'FAILED' })) },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: directName })
    await expect(within(dialog).getByRole('alert')).toHaveTextContent(
      '이 환불 줄은 환불 없이 닫혔어요. 환불 내역을 확인해 주세요',
    )
    await expect(within(dialog).getByRole('button', { name: '환불하기' })).not.toHaveAttribute(
      'aria-disabled',
    )
  },
}

/** 요청 환불 — 요청한 금액과 사유를 보이고, 금액 칸은 요청 금액에서 시작한다(낮춰서 환불할 수 있다). 그대로 확인하면 금액 없이, 고치면 고친 금액을 부모에 알린다 */
const request = adminRefund({
  amount: { amount: 2000, currency: 'KRW' },
  reasonCode: 'DUPLICATE',
})

export const ApproveARequest: Story = {
  render: () => <Demo mode="approve" request={request} order={{ refundableAmount: 3000 }} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '열기' }))
    const dialog = await screen.findByRole('dialog', { name: '요청대로 환불할까요?' })
    // 처음 포커스는 금액 칸(Enter 로 제출되지 않는다) - 승인도 낮출 금액을 곧바로 고쳐 쓸 수 있다. 거절 창만 「닫기」에서 시작한다
    await waitFor(() =>
      expect(within(dialog).getByRole('textbox', { name: '환불할 금액' })).toHaveFocus(),
    )
    // 어느 결제의 요청인지 - 금액만으로는 알 수 없다
    await expect(
      within(dialog).getByText('결제 번호', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('ord_1')
    await expect(dialog).toHaveTextContent('요청한 금액')
    await expect(dialog).toHaveTextContent('2,000원')
    await expect(dialog).toHaveTextContent('같은 결제가 두 번 됐어요')
    await expect(within(dialog).getByRole('textbox', { name: '환불할 금액' })).toHaveValue('2000')
    await expect(within(dialog).queryByRole('combobox')).toBeNull()
    const confirm = within(dialog).getByRole('button', { name: '환불하기' })
    await expect(confirm).toHaveAttribute('data-variant', 'danger')
    await userEvent.click(confirm)
    await expect(onConfirm).toHaveBeenCalledTimes(1)
    await expect(onConfirm).toHaveBeenCalledWith(undefined) // 요청 금액 그대로 - 금액을 싣지 않는다
  },
}

export const ApproveWithALoweredAmountSendsIt: Story = {
  render: () => <Demo mode="approve" request={request} order={{ refundableAmount: 3000 }} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '열기' }))
    const dialog = await screen.findByRole('dialog', { name: '요청대로 환불할까요?' })
    const amount = within(dialog).getByRole('textbox', { name: '환불할 금액' })
    await userEvent.clear(amount)
    await userEvent.type(amount, '2500') // 요청(2,000원)보다 많이는 환불하지 않는다
    await expectBlockedButReachable(dialog, '환불할 수 있는 금액(2,000원)을 넘을 수 없어요')
    await userEvent.clear(amount)
    await userEvent.type(amount, '1500')
    await userEvent.click(within(dialog).getByRole('button', { name: '환불하기' }))
    await expect(onConfirm).toHaveBeenCalledWith(1500)
  },
}

export const ApproveABiggerRequestThanWhatIsLeftStartsAtWhatIsLeft: Story = {
  args: { open: true, mode: 'approve', request, order: { refundableAmount: 1500 } },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: '요청대로 환불할까요?' })
    await expect(within(dialog).getByRole('textbox', { name: '환불할 금액' })).toHaveValue('1500')
    await expect(dialog).toHaveTextContent('환불할 수 있는 금액: 1,500원')
    await expect(within(dialog).getByRole('button', { name: '환불하기' })).not.toHaveAttribute(
      'aria-disabled',
    )
  },
}

export const DeclineARequest: Story = {
  render: () => <Demo mode="reject" request={request} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '열기' }))
    const dialog = await screen.findByRole('dialog', { name: '환불 요청을 거절할까요?' })
    await expect(dialog).toHaveTextContent('거절하면 돈은 나가지 않아요')
    const confirm = within(dialog).getByRole('button', { name: '거절하기' })
    await expect(confirm).toHaveAttribute('data-variant', 'primary') // 돈이 안 나가니 위험색이 아니다
    await userEvent.click(confirm)
    await expect(onConfirm).toHaveBeenCalledTimes(1)
  },
}

/** 승인이 결제사에 거절되면(402) 그 요청 줄은 환불 안 됨으로 닫힌다(스펙 §5.3) - 다시 눌러도 소용없으니 확인은 막히고, 결제 한 건으로 가는 길을 준다 */
export const ApprovalRefusedClosesTheRequest: Story = {
  args: {
    open: true,
    mode: 'approve',
    request,
    error: failure('PAYMENT.REFUND_DECLINED', 402, {
      category: 'TEMPORARY',
      providerCode: 'X_CODE',
    }),
    orderLink: (className) => (
      <a className={className} href="#/admin/payments/ord_1">
        결제 보기
      </a>
    ),
  },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: '요청대로 환불할까요?' })
    await expect(within(dialog).getByRole('alert')).toHaveTextContent(
      '요청은 환불 안 됨으로 닫혔어요. 결제 한 건에서 직접 환불해 주세요',
    )
    await expectBlockedButReachable(dialog, '요청은 환불 안 됨으로 닫혔어요')
    await expectButtonLike(within(dialog).getByRole('link', { name: '결제 보기' }))
    await expect(within(dialog).getByText('trace-7 / X_CODE')).toBeVisible()
  },
}

/**
 * 승인의 409 는 두 뜻이다 - 요청이 이미 결정됐거나(답을 잃은 뒤 다시 누름 · 다른 운영자 · 본인이 거둠), 주문이 환불할 수 없거나 결제사에 결제가 없다(계약 ④).
 * 어느 쪽인지 모르니 중립으로 말하고(「이미 처리된」이라고 단정하지 않는다) 결제 한 건으로 가는 길을 준다
 */
export const ApprovalNotAllowedIsSaidNeutrallyAndLeadsToThePayment: Story = {
  args: {
    open: true,
    mode: 'approve',
    request,
    error: failure('PAYMENT.REFUND_NOT_ALLOWED'),
    orderLink: (className) => (
      <a className={className} href="#/admin/payments/ord_1">
        결제 보기
      </a>
    ),
  },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: '요청대로 환불할까요?' })
    await expect(within(dialog).getByRole('alert')).toHaveTextContent(
      '지금은 이 요청대로 환불할 수 없어요. 결제 한 건에서 상태를 확인해 주세요',
    )
    await expect(within(dialog).getByRole('alert')).not.toHaveTextContent('이미 처리된')
    await expectBlockedButReachable(dialog, '결제 한 건에서 상태를 확인해 주세요')
    await expectButtonLike(within(dialog).getByRole('link', { name: '결제 보기' }))
  },
}

/** 승인이 400 `REFUND_AMOUNT_EXCEEDED` 로 끝나면 요청 줄은 `REQUESTED` 로 남는다(계약 ⑤) - 막다른 길이 아니다: 거절하거나 한 건에서 직접 환불. 「창을 닫고 다시 열어」는 이 창에서 뺀다 */
export const ApprovalAmountExceededLeavesTheRequestWaitingAndShowsTheWayOut: Story = {
  args: {
    open: true,
    mode: 'approve',
    request,
    error: failure('PAYMENT.REFUND_AMOUNT_EXCEEDED', 400),
    orderLink: (className) => (
      <a className={className} href="#/admin/payments/ord_1">
        결제 보기
      </a>
    ),
  },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: '요청대로 환불할까요?' })
    await expect(within(dialog).getByRole('alert')).toHaveTextContent(
      '요청 금액이 지금 환불할 수 있는 금액보다 커요. 요청을 거절하거나 결제 한 건에서 직접 환불해 주세요',
    )
    await expect(within(dialog).getByRole('alert')).not.toHaveTextContent('다시 열어')
    await expectBlockedButReachable(dialog, '요청을 거절하거나')
    await expectButtonLike(within(dialog).getByRole('link', { name: '결제 보기' }))
  },
}

/** 직접 환불의 409 `REFUND_IN_PROGRESS` - 열린 것이 기다리는 요청이면 「환불 중이에요」가 아니라 그 요청을 먼저 결정하라고 말한다 */
export const InProgressBecauseARequestIsWaitingSaysDecideTheRequest: Story = {
  args: {
    open: true,
    order: order({ openRefundStatus: 'REQUESTED' }),
    error: failure('PAYMENT.REFUND_IN_PROGRESS'),
  },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: directName })
    await expect(within(dialog).getByRole('alert')).toHaveTextContent(
      '기다리는 환불 요청이 있어요. 그 요청을 먼저 결정해 주세요',
    )
    await expectBlockedButReachable(dialog, '그 요청을 먼저 결정해 주세요')
  },
}

/** 결과를 모르는 동안 금액 · 사유 칸은 읽기 전용이다 - 닿고, 이유 한 줄이 두 칸의 설명이다 */
export const UnknownResultLocksTheAmountAndTheReason: Story = {
  args: { open: true, error: failure('COMMON.INTERNAL', 500) },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: directName })
    const amount = within(dialog).getByLabelText('환불할 금액')
    const reason = within(dialog).getByLabelText('환불 사유')
    for (const field of [amount, reason]) {
      await expect(field).toHaveAttribute('readonly')
      await expect(field).not.toBeDisabled()
      await expect(field).toHaveAccessibleDescription(
        expect.stringContaining('결과를 확인할 때까지 금액과 사유는 바꿀 수 없어요'),
      )
    }
    await expect(amount).toHaveValue('3000')
    await expect(reason).toHaveValue('운영자가 환불함')
  },
}

export const ApprovalLostAnswerKeepsTheWayToLook: Story = {
  args: {
    open: true,
    mode: 'approve',
    request,
    error: failure('COMMON.TIMEOUT', 504),
    orderLink: (className) => (
      <a className={className} href="#/admin/payments/ord_1">
        결제 보기
      </a>
    ),
  },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: '요청대로 환불할까요?' })
    await expect(within(dialog).getByRole('alert')).toHaveTextContent(
      '환불 결과를 확인하지 못했어요',
    )
    await expectButtonLike(within(dialog).getByRole('link', { name: '결제 보기' }))
    await expect(within(dialog).getByRole('button', { name: '환불하기' })).not.toHaveAttribute(
      'aria-disabled',
    )
  },
}

export const DeclineFailedSaysSo: Story = {
  args: { open: true, mode: 'reject', request, error: failure('PAYMENT.REFUND_NOT_FOUND', 404) },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: '환불 요청을 거절할까요?' })
    await expect(within(dialog).getByRole('alert')).toHaveTextContent('거절하지 못했어요')
    await expect(within(dialog).getByText('trace-7')).toBeVisible()
  },
}

export const DeclineAlreadyDecided: Story = {
  args: { open: true, mode: 'reject', request, error: failure('PAYMENT.REFUND_NOT_ALLOWED') },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: '환불 요청을 거절할까요?' })
    await expect(within(dialog).getByRole('alert')).toHaveTextContent('이미 처리된 요청이에요')
    const confirm = within(dialog).getByRole('button', { name: '거절하기' })
    await expect(confirm).toHaveAttribute('aria-disabled', 'true')
    await expect(confirm).not.toBeDisabled()
  },
}

export const DeclineLostAnswerIsUnknown: Story = {
  args: { open: true, mode: 'reject', request, error: new TypeError('network') },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: '환불 요청을 거절할까요?' })
    await expect(within(dialog).getByRole('alert')).toHaveTextContent(
      '거절 결과를 확인하지 못했어요',
    )
  },
}

/**
 * 직접 환불을 훅에 이은 정본 - 한 번의 의도는 한 `Idempotency-Key` 다. **결과를 모르면** 같은 입력으로 다시 눌러도 같은 키(서버가 이미 만든 환불을 돌려준다),
 * **결과가 정해지면**(결제사 거절 · 503 · 환불 없이 닫힌 줄) 다음 누름은 새 키 - 같은 키로는 서버가 새 환불 줄을 만들 수 없다.
 * 답 줄이 `FAILED` 로 닫혀 있으면 성공처럼 창을 닫지 않고 실패로 말한다. `PENDING` 은 환불이 나가는 중이라 창이 닫히고 뒷 화면이 「환불 중」을 말한다.
 */
const sentKeys: Array<string | undefined> = []
let script: Array<() => Promise<Refund>> = []
const scriptedApi = {
  refundOrder: async (
    _orderId: string,
    _input: unknown,
    options?: { idempotencyKey?: string },
  ): Promise<Refund> => {
    sentKeys.push(options?.idempotencyKey)
    const step = script.shift()
    if (!step) throw new Error('script ran out')
    return step()
  },
  syncOrder: async (): Promise<unknown> => {
    syncCalls += 1
    return syncStep()
  },
} as unknown as PaymentAdminApi
let syncCalls = 0
let syncStep: () => Promise<unknown> = async () => adminOrder()
const goes =
  (status: Refund['status'] = 'SUCCEEDED', amount = 3000) =>
  async () =>
    adminRefund({ status, amount: { amount, currency: 'KRW' } })
const lost = async (): Promise<Refund> => {
  throw new Error('network')
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
/** 지금 멈춰 둔 시계(없으면 `null`) - `lostAfter` 가 실제로 자지 않고 이 시계를 흘린다 */
let frozen: ReturnType<typeof freezeClock> | null = null
/**
 * 모름이 된 환불의 유예(`unsureHoldMs` · `unsureFloorMs`)는 `Date.now()` 로 센다. 실제 시간으로 기다리면 부하가 큰 기계에서 「유예 안의 첫 맞추기」가 유예를 넘겨 버려
 * 시험이 흔들린다(100ms 안에 창을 닫고 누르는 일이 늘 되지 않는다) - 시계를 멈춰 두고 시험이 직접 흘려 보낸다. 끝나면 꼭 `restore()`(try/finally)
 */
function freezeClock() {
  const real = Date.now
  let now = real()
  // `spyOn` 을 쓰지 않는다 - 스토리북의 spyOn 은 호출마다 기록하는데 `Date.now` 는 쉴 새 없이 불려 화면이 멈춘다
  Date.now = () => now
  const clock = {
    advance: (ms: number) => {
      now += ms
    },
    restore: () => {
      Date.now = real
      frozen = null
    },
  }
  frozen = clock
  return clock
}
/** 답이 `ms` 뒤에야 유실로 끝난다 - 시간 초과로 모름이 된 보내기(모름이 된 때에는 보낸 지 이미 오래다) */
const lostAfter = (ms: number) => async (): Promise<Refund> => {
  // 시계를 멈춰 둔 시험은 그 시계를 `ms` 흘린다(보낸 때와 모름이 된 때가 달라야 유예의 바닥 규칙이 시험된다) - 아니면 실제로 잔다
  if (frozen) frozen.advance(ms)
  else await sleep(ms)
  throw new Error('network')
}
const answers = (code: string, status: number, data?: unknown) => async (): Promise<Refund> => {
  throw failure(code, status, data)
}

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
  const refund = useOperatorRefund(scriptedApi)
  return (
    <AdminRefundDialog
      open={open}
      mode="direct"
      order={order()}
      onClose={() => setOpen(false)}
      onConfirm={(input) =>
        refund.mutate({ orderId: 'ord_1', ...input }, { onSuccess: () => setOpen(false) })
      }
      busy={refund.isPending}
      error={refund.error}
      labels={koPaymentLabels}
      locale="ko-KR"
    />
  )
}

const withScript = (...steps: Array<() => Promise<Refund>>) => ({
  beforeEach: () => {
    sentKeys.length = 0
    script = [...steps]
    syncCalls = 0
    syncStep = async () => adminOrder()
  },
  render: () => <WiredDialog />,
})

async function pressRefund(
  dialog: HTMLElement,
  userEvent: { click: (el: Element) => Promise<void> },
) {
  await userEvent.click(within(dialog).getByRole('button', { name: '환불하기' }))
}

export const RetryAfterALostAnswerKeepsTheSameKey: Story = {
  ...withScript(lost, goes()),
  play: async ({ userEvent }) => {
    const dialog = await screen.findByRole('dialog', { name: directName })
    await pressRefund(dialog, userEvent)
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '환불 결과를 확인하지 못했어요',
    )
    await pressRefund(dialog, userEvent)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(sentKeys).toHaveLength(2)
    await expect(sentKeys[0]).toMatch(/^fe-/)
    await expect(sentKeys[1]).toBe(sentKeys[0])
  },
}

export const AfterARefusalTheNextPressUsesANewKey: Story = {
  ...withScript(answers('PAYMENT.REFUND_DECLINED', 402, { category: 'TEMPORARY' }), goes()),
  play: async ({ userEvent }) => {
    const dialog = await screen.findByRole('dialog', { name: directName })
    await pressRefund(dialog, userEvent)
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '결제사에 잠시 문제가 생겼어요',
    )
    await pressRefund(dialog, userEvent)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(sentKeys).toHaveLength(2)
    await expect(sentKeys[1]).not.toBe(sentKeys[0])
  },
}

export const AfterNothingWasSentTheNextPressUsesANewKey: Story = {
  ...withScript(answers('PAYMENT.UNAVAILABLE', 503), goes()),
  play: async ({ userEvent }) => {
    const dialog = await screen.findByRole('dialog', { name: directName })
    await pressRefund(dialog, userEvent)
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '지금은 환불을 보낼 수 없어요',
    )
    await pressRefund(dialog, userEvent)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(sentKeys[1]).not.toBe(sentKeys[0])
  },
}

/** 같은 키를 다시 보내면 서버는 그 줄을 지금 상태 그대로 돌려준다 - `FAILED` 줄을 성공처럼 창을 닫지 않는다 */
export const AClosedLineIsNotASuccess: Story = {
  ...withScript(goes('FAILED'), goes()),
  play: async ({ userEvent }) => {
    const dialog = await screen.findByRole('dialog', { name: directName })
    await pressRefund(dialog, userEvent)
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '이 환불 줄은 환불 없이 닫혔어요. 환불 내역을 확인해 주세요',
    )
    await expect(screen.getByRole('dialog', { name: directName })).toBeVisible() // 닫히지 않았다
    await pressRefund(dialog, userEvent)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(sentKeys[1]).not.toBe(sentKeys[0])
  },
}

export const APendingLineClosesTheWindow: Story = {
  ...withScript(goes('PENDING')),
  play: async ({ userEvent }) => {
    const dialog = await screen.findByRole('dialog', { name: directName })
    await pressRefund(dialog, userEvent)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(sentKeys).toHaveLength(1)
  },
}

/**
 * 직접 환불을 **진짜 훅**(`useDirectRefund`)과 한 건 화면의 부품(`AdminOrderPanel`)에 이은 정본.
 * 결과를 모르는 동안(답 유실 · 시간 초과)에는 금액 · 사유가 잠기고, 창을 닫았다 다시 열어도, 일하는 중에 × 로 닫았다 다시 열어도 처음 모습(전액)으로 돌아가지 않는다 -
 * 키는 의도(주문 · 사유 · 금액)별이라 값이 바뀌면 새 키가 나가 이미 나간 부분 환불이 한 번 더 나간다. 같은 내용으로 다시 보내면 같은 키다.
 * 환불이 나갔는데 화면을 다시 읽지 못했다면(`reloadFails`) 그 말을 상태 글자로 하고 돈이 나가는 단추를 막는다 - 환불 전 그대로인 화면에서 같은 환불을 또 누르지 않게.
 */
let releaseSend: (outcome: 'done' | 'lost' | 'refused') => void = () => undefined
const hangs = () =>
  new Promise<Refund>((resolve, reject) => {
    releaseSend = (outcome) =>
      outcome === 'done'
        ? resolve(adminRefund({ status: 'SUCCEEDED', amount: { amount: 2000, currency: 'KRW' } }))
        : outcome === 'refused'
          ? reject(failure('PAYMENT.REFUND_DECLINED', 402, { category: 'TEMPORARY' }))
          : reject(new Error('network'))
  })
/** 「결제사와 맞추기」 - 끝나는 때를 스토리가 정한다 */
let releaseSync: (outcome: 'ok' | 'fail') => void = () => undefined
const syncHangs = () =>
  new Promise<unknown>((resolve, reject) => {
    releaseSync = (outcome) => (outcome === 'ok' ? resolve(adminOrder()) : reject(new Error('x')))
  })

function DirectPage({
  reloadFails = false,
  holdMs,
}: {
  reloadFails?: boolean
  /** 환불을 보낸 뒤 이만큼(ms) 지나야 맞추기가 모름을 푼다 - 주지 않으면 환불 호출의 제한 시간(45초) */
  holdMs?: number
}) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { mutations: { retry: false } } }),
  )
  return (
    <QueryClientProvider client={client}>
      <DirectScreen reloadFails={reloadFails} holdMs={holdMs} />
    </QueryClientProvider>
  )
}

function DirectScreen({ reloadFails, holdMs }: { reloadFails: boolean; holdMs?: number }) {
  const o = adminOrder()
  const sync = useSyncOrder(scriptedApi)
  const direct = useDirectRefund(scriptedApi, {
    order: o,
    labels: koPaymentLabels,
    locale: 'ko-KR',
    // 환불을 보내면 맞춘 뒤의 안내를 거둔다 - 그때까지의 사실이다. 맞추는 중이면 그 답을 기다린다(보내기 전에 시작한 일을 끊지 않는다)
    onSend: () => {
      if (!sync.isPending) sync.reset()
    },
    ...(holdMs !== undefined ? { unsureHoldMs: holdMs, unsureFloorMs: holdMs } : {}),
  })
  // 맞추기가 모름을 못 놓았다면(보낸 환불이 아직 가는 중일 수 있다) 그 말을 한다 - 다음 맞추기를 시작하면 지운다
  const [held, setHeld] = useState<number | null>(null)
  return (
    <>
      <AdminOrderPanel
        detail={{ order: o, refunds: [], events: [] }}
        onRefund={direct.ask}
        onSync={() => {
          setHeld(null)
          sync.mutate(o.id, { onSuccess: () => setHeld(heldSecondsOf(direct.forget())) })
        }}
        syncing={sync.isPending}
        synced={sync.data}
        syncHeld={direct.unsure ? held : null}
        syncError={sync.error}
        refunded={direct.done}
        stale={reloadFails && direct.done !== undefined}
        labels={koPaymentLabels}
        locale="ko-KR"
        formatTime={() => '2026. 1. 1.'}
      />
      {direct.dialog}
    </>
  )
}

/** 환불을 보낸 뒤 이만큼(ms) 지나야 맞추기가 모름을 푼다 - 다시 보내면 다시 센다 */
const withDirectHoldingFor = (holdMs: number, ...steps: Array<() => Promise<Refund>>) => ({
  ...withScript(...steps),
  render: () => <DirectPage holdMs={holdMs} />,
})

const withDirect = (reloadFails: boolean, ...steps: Array<() => Promise<Refund>>) => ({
  ...withScript(...steps),
  render: () => <DirectPage reloadFails={reloadFails} />,
})

/** 보낸 지 얼마 안 됐어도 맞추기가 모름을 푸는 화면 - 기다림(45초)을 건너뛴다 */
const withDirectAfterHold = (...steps: Array<() => Promise<Refund>>) => ({
  ...withScript(...steps),
  render: () => <DirectPage holdMs={0} />,
})

const openDirect = async (
  canvas: { getByRole: (role: string, options: { name: string }) => HTMLElement },
  userEvent: { click: (el: Element) => Promise<void> },
) => {
  await userEvent.click(canvas.getByRole('button', { name: '환불하기' }))
  return screen.findByRole('dialog', { name: directName })
}

async function typeAmount(
  dialog: HTMLElement,
  userEvent: {
    clear: (el: Element) => Promise<void>
    type: (el: Element, text: string) => Promise<void>
  },
  text: string,
) {
  const field = within(dialog).getByLabelText('환불할 금액')
  await userEvent.clear(field)
  await userEvent.type(field, text)
}

export const AnUnsureRefundLocksWhatWasSentAndResendsTheSameKey: Story = {
  ...withDirect(false, lost, goes()),
  play: async ({ canvas, userEvent }) => {
    const dialog = await openDirect(canvas, userEvent)
    await typeAmount(dialog, userEvent, '2000')
    await pressRefund(dialog, userEvent)
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '환불 결과를 확인하지 못했어요',
    )
    const amount = within(dialog).getByLabelText('환불할 금액')
    const reason = within(dialog).getByLabelText('환불 사유')
    await expect(amount).toHaveAttribute('readonly')
    await expect(reason).toHaveAttribute('readonly')
    await userEvent.type(amount, '9') // 읽기 전용 - 글자가 들어가지 않는다
    await expect(amount).toHaveValue('2000')
    await pressRefund(dialog, userEvent)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(sentKeys).toHaveLength(2)
    await expect(sentKeys[1]).toBe(sentKeys[0]) // 같은 내용, 같은 키
  },
}

/** 창을 닫고 다시 열어도 모름 상태는 그대로다 - 처음 모습(전액)으로 돌아가 다른 금액을 새 키로 보내게 두지 않는다 */
export const AnUnsureRefundSurvivesClosingAndOpeningAgain: Story = {
  ...withDirect(false, lost, goes()),
  play: async ({ canvas, userEvent }) => {
    let dialog = await openDirect(canvas, userEvent)
    await typeAmount(dialog, userEvent, '2000')
    await pressRefund(dialog, userEvent)
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '환불 결과를 확인하지 못했어요',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    dialog = await openDirect(canvas, userEvent)
    await expect(within(dialog).getByRole('alert')).toHaveTextContent(
      '환불 결과를 확인하지 못했어요',
    ) // 묵은 오류로 지워지지 않았다
    await expect(within(dialog).getByLabelText('환불할 금액')).toHaveValue('2000')
    await expect(within(dialog).getByLabelText('환불할 금액')).toHaveAttribute('readonly')
    await pressRefund(dialog, userEvent)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(sentKeys[1]).toBe(sentKeys[0])
  },
}

/** 일하는 중에 × 로 닫았다 다시 열어도 금액 칸이 전액으로 돌아가지 않는다 - 모름으로 끝나면 「다시」 아래의 금액이 보낸 값과 같아야 한다 */
export const ReopeningWhileSendingKeepsTheAmountThatWasSent: Story = {
  ...withDirect(false, hangs, goes()),
  play: async ({ canvas, userEvent }) => {
    let dialog = await openDirect(canvas, userEvent)
    await typeAmount(dialog, userEvent, '2000')
    await pressRefund(dialog, userEvent)
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /환불하는 중/ })).toBeDisabled(),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '창 닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    dialog = await openDirect(canvas, userEvent)
    await expect(within(dialog).getByLabelText('환불할 금액')).toHaveValue('2000') // 3000 으로 돌아가지 않았다
    releaseSend('lost')
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '환불 결과를 확인하지 못했어요',
    )
    await expect(within(dialog).getByLabelText('환불할 금액')).toHaveValue('2000')
    await pressRefund(dialog, userEvent)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(sentKeys).toHaveLength(2)
    await expect(sentKeys[1]).toBe(sentKeys[0])
  },
}

/** 확정 판정(결제사 거절)은 잠그지 않는다 - 금액 · 사유를 고쳐 새 키로 다시 보낼 수 있다 */
export const ASettledRefusalKeepsTheFieldsOpen: Story = {
  ...withDirect(false, answers('PAYMENT.REFUND_DECLINED', 402, { category: 'TEMPORARY' }), goes()),
  play: async ({ canvas, userEvent }) => {
    const dialog = await openDirect(canvas, userEvent)
    await pressRefund(dialog, userEvent)
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '결제사에 잠시 문제가 생겼어요',
    )
    await expect(within(dialog).getByLabelText('환불할 금액')).not.toHaveAttribute('readonly')
    await expect(within(dialog).getByLabelText('환불 사유')).toBeEnabled()
  },
}

/**
 * 닫아 둔 창이 확정 오류로 다시 열려도 보낸 값 그대로다 - 부분 금액과 사유를 보내고 × 로 닫았는데 서버가 확정 답(여기서는 결제사의 일시 거절)을 주면,
 * 다시 열린 창은 전액 · 운영자 사유로 돌아가 있지 않다. 돌아가 있으면 오류 옆의 열린 확인 한 번으로 보내지 않은 전액이 나간다.
 */
export const AClosedWindowThatReopensOnASettledErrorKeepsWhatWasSent: Story = {
  ...withDirect(false, hangs, goes()),
  play: async ({ canvas, userEvent }) => {
    let dialog = await openDirect(canvas, userEvent)
    await typeAmount(dialog, userEvent, '2000')
    await userEvent.selectOptions(within(dialog).getByLabelText('환불 사유'), 'DUPLICATE')
    await pressRefund(dialog, userEvent)
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /환불하는 중/ })).toBeDisabled(),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '창 닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    releaseSend('refused')
    dialog = await screen.findByRole('dialog', { name: directName }) // 오류로 끝나 창이 다시 열렸다
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '결제사에 잠시 문제가 생겼어요',
    )
    await expect(within(dialog).getByLabelText('환불할 금액')).toHaveValue('2000') // 3000 이 아니다
    await expect(within(dialog).getByLabelText('환불 사유')).toHaveValue('DUPLICATE') // 운영자 사유가 아니다
    await expect(within(dialog).getByRole('button', { name: '환불하기' })).not.toHaveAttribute(
      'aria-disabled',
    )
  },
}

/**
 * 보내는 중에는 금액 · 사유 칸을 고칠 수 없다(읽기 전용이되 닿고, 이유 한 줄이 두 칸의 설명이다) - 보내는 동안 3000 으로 고쳐 두면 모름으로 끝났을 때
 * 보내지 않은 값이 「잠긴 값」이 되어, 확인 한 번에 의도가 달라진 새 키가 나가고 첫 2000 이 나가 있었다면 3000 이 더 나간다. 모름으로 끝나면 잠긴 값 = 보낸 값.
 */
export const WhileSendingTheFieldsCannotBeEditedAndAnUnsureEndLocksWhatWasSent: Story = {
  ...withDirect(false, hangs, goes('SUCCEEDED', 2000)),
  play: async ({ canvas, userEvent }) => {
    const dialog = await openDirect(canvas, userEvent)
    await typeAmount(dialog, userEvent, '2000')
    await userEvent.selectOptions(within(dialog).getByLabelText('환불 사유'), 'DUPLICATE')
    await pressRefund(dialog, userEvent)
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /환불하는 중/ })).toBeDisabled(),
    )
    const amount = within(dialog).getByLabelText('환불할 금액')
    const reason = within(dialog).getByLabelText('환불 사유')
    await expect(amount).toHaveAttribute('readonly')
    await expect(reason).toHaveAttribute('readonly')
    await expect(amount).not.toBeDisabled() // 닿는다
    await expect(amount).toHaveAccessibleDescription(/보내는 중이라/)
    await expect(reason).toHaveAccessibleDescription(/보내는 중이라/)
    await userEvent.type(amount, '9') // 글자가 들어가지 않는다
    await expect(amount).toHaveValue('2000')
    releaseSend('lost')
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '환불 결과를 확인하지 못했어요',
    )
    await expect(within(dialog).getByLabelText('환불할 금액')).toHaveValue('2000')
    await expect(within(dialog).getByLabelText('환불 사유')).toHaveValue('같은 결제가 두 번 됐어요')
    await expect(within(dialog).getByLabelText('환불할 금액')).toHaveAccessibleDescription(
      /결과를 확인할 때까지/,
    )
    await pressRefund(dialog, userEvent)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(sentKeys).toHaveLength(2)
    await expect(sentKeys[1]).toBe(sentKeys[0])
  },
}

/** 잠긴 칸이 보이는 값은 적던 글자(`draft`)가 아니라 **보낸 값**이다 - 보낸 값을 주면 칸에 다른 글자가 있어도 보낸 값이 읽힌다 */
export const ALockedWindowShowsTheValuesThatWereSentNotTheTypedOnes: Story = {
  render: () => (
    <Demo error={new Error('network')} sent={{ amount: 2000, reasonCode: 'DUPLICATE' }} />
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '열기' }))
    const dialog = await screen.findByRole('dialog', { name: directName })
    await expect(within(dialog).getByLabelText('환불할 금액')).toHaveValue('2000') // 처음 값 3000 이 아니다
    await expect(within(dialog).getByLabelText('환불 사유')).toHaveValue('같은 결제가 두 번 됐어요')
  },
}

/**
 * 「결제사와 맞추기」가 성공하면 모름이 풀리고 **든 키도 놓인다** - 장부가 결제사와 맞았으니 그 뒤의 환불은 운영자가 새로 정한 새 의도라서,
 * 같은 금액 · 같은 사유여도 새 키로 나간다(나가 있던 환불은 환불 줄로 보인다).
 */
export const MatchingWithTheProviderLetsGoOfTheLockAndTheKey: Story = {
  ...withDirectAfterHold(lost, goes('SUCCEEDED', 2000)),
  play: async ({ canvas, userEvent }) => {
    let dialog = await openDirect(canvas, userEvent)
    await typeAmount(dialog, userEvent, '2000')
    await pressRefund(dialog, userEvent)
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '환불 결과를 확인하지 못했어요',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await userEvent.click(canvas.getByRole('button', { name: '결제사와 맞추기' }))
    await expect(await canvas.findByText('결제사와 맞췄어요')).toBeVisible()
    dialog = await openDirect(canvas, userEvent)
    await expect(within(dialog).queryByRole('alert')).toBeNull() // 모름이 풀렸다
    await expect(within(dialog).getByLabelText('환불할 금액')).toHaveValue('3000')
    await expect(within(dialog).getByLabelText('환불할 금액')).not.toHaveAttribute('readonly')
    await typeAmount(dialog, userEvent, '2000') // 먼저와 같은 금액 · 같은 사유
    await pressRefund(dialog, userEvent)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(sentKeys).toHaveLength(2)
    await expect(sentKeys[1]).not.toBe(sentKeys[0]) // 새 의도 - 새 키
  },
}

/**
 * 보낸 지 얼마 안 됐으면(환불 호출의 제한 시간 안) 맞추기가 성공해도 모름을 풀지 않는다 - 첫 요청이 서버에서 아직 환불 줄을 만들기 전(환불 전 확인 조회 중)일 수 있어
 * 맞추기가 본 장부에는 환불 줄이 없는데, 그 상태로 키를 놓으면 같은 환불이 새 키로 한 번 더 나갈 수 있다. 맞추기 결과(「결제사와 맞췄어요」)는 보이되 잠금 · 키는 그대로다
 */
export const MatchingRightAfterAnUnsureSendKeepsTheLockAndTheKey: Story = {
  ...withDirect(false, lost, goes('SUCCEEDED', 2000)),
  play: async ({ canvas, userEvent }) => {
    let dialog = await openDirect(canvas, userEvent)
    await typeAmount(dialog, userEvent, '2000')
    await pressRefund(dialog, userEvent)
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '환불 결과를 확인하지 못했어요',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await userEvent.click(canvas.getByRole('button', { name: '결제사와 맞추기' }))
    await expect(await canvas.findByText('결제사와 맞췄어요')).toBeVisible() // 맞추기 결과는 보인다
    // 왜 잠금이 그대로인지 말한다 - 조용히 아무 일도 안 한 것처럼 보이지 않게
    await expect(await canvas.findByText(/보낸 환불이 아직 가는 중일 수 있어요/)).toBeVisible()
    await expect(
      canvas.getByText(/잠시 뒤 다시 맞춰 주세요/).closest('[role="status"]'),
    ).not.toBeNull()
    dialog = await openDirect(canvas, userEvent)
    await expect(within(dialog).getByRole('alert')).toHaveTextContent(
      '환불 결과를 확인하지 못했어요',
    ) // 모름이 풀리지 않았다
    await expect(within(dialog).getByLabelText('환불할 금액')).toHaveValue('2000')
    await expect(within(dialog).getByLabelText('환불할 금액')).toHaveAttribute('readonly')
    await pressRefund(dialog, userEvent)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(sentKeys).toHaveLength(2)
    await expect(sentKeys[1]).toBe(sentKeys[0]) // 같은 내용, 같은 키
    // 모름이 풀렸으니(다시 보낸 것이 성공) 「가는 중일 수 있어요」는 더 말하지 않는다
    await waitFor(() =>
      expect(canvas.queryByText(/보낸 환불이 아직 가는 중일 수 있어요/)).toBeNull(),
    )
  },
}

/**
 * 시간 초과로 모름이 된 보내기는 보낸 지 이미 환불 호출의 제한 시간이 지나 있다 - 유예를 보낸 때부터 세니 45초를 한 번 더 기다리지는 않는다.
 * 다만 보낸 때가 실제로 나간 때가 아닐 수 있어 모름이 된 때부터 바닥(실제로는 15초, 여기서는 100ms)을 둔다: 첫 맞추기는 문구와 함께 한 번 기다리고,
 * 바닥이 지난 뒤의 맞추기가 푼다. 말없이 막히지도 않는다
 */
export const MatchingAfterATimedOutSendWaitsOnceThenLetsGo: Story = {
  ...withDirectHoldingFor(100, lostAfter(300), goes('SUCCEEDED', 2000)),
  play: async ({ canvas, userEvent }) => {
    const clock = freezeClock()
    try {
      let dialog = await openDirect(canvas, userEvent)
      await typeAmount(dialog, userEvent, '2000')
      await pressRefund(dialog, userEvent)
      await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        '환불 결과를 확인하지 못했어요',
      ) // 보낸 지 300ms 가 지나서야 모름이 됐다(유예 100ms 는 이미 지났다)
      await userEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      await userEvent.click(canvas.getByRole('button', { name: '결제사와 맞추기' }))
      await expect(await canvas.findByText('결제사와 맞췄어요')).toBeVisible()
      await expect(await canvas.findByText(/보낸 환불이 아직 가는 중일 수 있어요/)).toBeVisible() // 바닥 안의 첫 맞추기는 말하고 기다린다
      clock.advance(150) // 모름이 된 지 바닥(100ms)이 지났다
      await userEvent.click(canvas.getByRole('button', { name: '결제사와 맞추기' }))
      await waitFor(() =>
        expect(canvas.queryByText(/보낸 환불이 아직 가는 중일 수 있어요/)).toBeNull(),
      )
      dialog = await openDirect(canvas, userEvent)
      await expect(within(dialog).queryByRole('alert')).toBeNull() // 두 번째 맞추기로 모름이 풀렸다
      await expect(within(dialog).getByLabelText('환불할 금액')).not.toHaveAttribute('readonly')
    } finally {
      clock.restore()
    }
  },
}

/**
 * 다시 보내면 유예를 **다시 센다** - 첫 보내기가 오래전이어도 지금 막 다시 보낸 환불은 아직 가는 중일 수 있다.
 * 값이 낡아(첫 보내기 시각이 남아) 바로 풀리면 두 번째 환불이 새 키로 한 번 더 나갈 수 있다
 */
export const AResendCountsTheHoldFromTheResend: Story = {
  ...withDirectHoldingFor(400, lost, lost, goes('SUCCEEDED', 2000)),
  play: async ({ canvas, userEvent }) => {
    const clock = freezeClock()
    try {
      let dialog = await openDirect(canvas, userEvent)
      await typeAmount(dialog, userEvent, '2000')
      await pressRefund(dialog, userEvent)
      await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        '환불 결과를 확인하지 못했어요',
      )
      clock.advance(500) // 첫 보내기의 유예(400ms)는 지났다
      await pressRefund(dialog, userEvent) // 같은 내용으로 다시 보냈지만 또 모름 - 이 보내기부터 다시 센다
      await waitFor(() => expect(sentKeys).toHaveLength(2))
      await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        '환불 결과를 확인하지 못했어요',
      )
      await userEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      await userEvent.click(canvas.getByRole('button', { name: '결제사와 맞추기' }))
      await expect(await canvas.findByText(/보낸 환불이 아직 가는 중일 수 있어요/)).toBeVisible()
      dialog = await openDirect(canvas, userEvent)
      await expect(within(dialog).getByLabelText('환불할 금액')).toHaveAttribute('readonly') // 풀리지 않았다
      await pressRefund(dialog, userEvent)
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      await expect(sentKeys).toHaveLength(3)
      await expect(sentKeys[2]).toBe(sentKeys[0]) // 줄곧 같은 키
    } finally {
      clock.restore()
    }
  },
}

/** 맞추기가 실패하면 아무것도 풀리지 않는다 - 결과는 여전히 모른다(칸도 키도 그대로) */
export const AFailedMatchingLeavesTheUnsureRefundLocked: Story = {
  ...withDirect(false, lost, goes('SUCCEEDED', 2000)),
  play: async ({ canvas, userEvent }) => {
    let dialog = await openDirect(canvas, userEvent)
    await typeAmount(dialog, userEvent, '2000')
    await pressRefund(dialog, userEvent)
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '환불 결과를 확인하지 못했어요',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    syncStep = async () => {
      throw new Error('network')
    }
    await userEvent.click(canvas.getByRole('button', { name: '결제사와 맞추기' }))
    await expect(await canvas.findByText('맞추지 못했어요. 다시 해 보세요')).toBeVisible()
    dialog = await openDirect(canvas, userEvent)
    await expect(within(dialog).getByRole('alert')).toHaveTextContent(
      '환불 결과를 확인하지 못했어요',
    )
    await expect(within(dialog).getByLabelText('환불할 금액')).toHaveValue('2000')
    await expect(within(dialog).getByLabelText('환불할 금액')).toHaveAttribute('readonly')
    await pressRefund(dialog, userEvent)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(sentKeys[1]).toBe(sentKeys[0])
  },
}

/**
 * 모름 상태에서 맞추기를 누르고, 끝나기 전에 같은 키로 다시 보내는 중이면 - 맞추기가 성공해도 일하는 중인 변경을 건드리지 않는다
 * (`reset()` 하면 보내는 중이 풀려 확인이 다시 눌리고, 같은 환불이 한 번 더 나갈 수 있다). 그 순간의 상태를 본다.
 */
export const MatchingThatEndsWhileResendingDoesNotDisturbTheResend: Story = {
  ...withDirect(false, lost, hangs),
  play: async ({ canvas, userEvent }) => {
    let dialog = await openDirect(canvas, userEvent)
    await typeAmount(dialog, userEvent, '2000')
    await pressRefund(dialog, userEvent)
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '환불 결과를 확인하지 못했어요',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    syncStep = syncHangs
    await userEvent.click(canvas.getByRole('button', { name: '결제사와 맞추기' }))
    await waitFor(() => expect(syncCalls).toBe(1))
    dialog = await openDirect(canvas, userEvent)
    await pressRefund(dialog, userEvent) // 같은 내용, 같은 키로 다시 보내는 중
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /환불하는 중/ })).toBeDisabled(),
    )
    releaseSync('ok') // 맞추기가 성공으로 끝난다
    await expect(await canvas.findByText('결제사와 맞췄어요')).toBeVisible()
    await expect(within(dialog).getByRole('button', { name: /환불하는 중/ })).toBeDisabled() // 풀리지 않았다
    releaseSend('done')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(sentKeys).toHaveLength(2)
    await expect(sentKeys[1]).toBe(sentKeys[0])
  },
}

/** 맞춘 뒤의 안내(「결제사와 맞췄어요」)는 맞춘 때까지의 사실이다 - 그 뒤에 환불이 나가면 거둔다(`onSend` → `sync.reset`). 다음 맞추기가 다시 말한다 */
export const TheMatchedNoteLeavesWhenARefundGoesOut: Story = {
  ...withDirect(false, goes('SUCCEEDED', 2000)),
  play: async ({ canvas, userEvent }) => {
    syncStep = async () => adminOrder()
    await userEvent.click(canvas.getByRole('button', { name: '결제사와 맞추기' }))
    await expect(await canvas.findByText('결제사와 맞췄어요')).toBeVisible()
    const dialog = await openDirect(canvas, userEvent)
    await typeAmount(dialog, userEvent, '2000')
    await pressRefund(dialog, userEvent)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(canvas.queryByText('결제사와 맞췄어요')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: '결제사와 맞추기' }))
    await expect(await canvas.findByText('결제사와 맞췄어요')).toBeVisible()
  },
}

/** 보낸 순간 낡는다 - 결과를 모르는 환불(답 유실)도 돈이 나갔을 수 있어서, 「맞췄어요」가 환불 뒤에 맞춘 것처럼 읽히면 안 된다 */
export const TheMatchedNoteLeavesTheMomentARefundIsSentEvenIfItsAnswerIsLost: Story = {
  ...withDirect(false, lost),
  play: async ({ canvas, userEvent }) => {
    syncStep = async () => adminOrder()
    await userEvent.click(canvas.getByRole('button', { name: '결제사와 맞추기' }))
    await expect(await canvas.findByText('결제사와 맞췄어요')).toBeVisible()
    const dialog = await openDirect(canvas, userEvent)
    await typeAmount(dialog, userEvent, '2000')
    await pressRefund(dialog, userEvent)
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '환불 결과를 확인하지 못했어요',
    )
    await expect(canvas.queryByText('결제사와 맞췄어요')).toBeNull()
  },
}

/** 환불이 나갔는데 화면을 다시 읽지 못했다 - 성공을 말로 하고, 낡은 화면에서 같은 환불을 또 누르지 못하게 막는다(단추는 닿고 이유가 설명이다) */
export const ARefundThatWentOutIsSaidAndTheOldScreenCannotSendItAgain: Story = {
  ...withDirect(true, goes('SUCCEEDED', 2000)),
  play: async ({ canvas, userEvent }) => {
    const dialog = await openDirect(canvas, userEvent)
    await typeAmount(dialog, userEvent, '2000')
    await pressRefund(dialog, userEvent)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(canvas.getByRole('status')).toHaveTextContent('환불했어요: 2,000원')
    const again = canvas.getByRole('button', { name: '환불하기' })
    await expect(again).toHaveAttribute('aria-disabled', 'true')
    await expect(again).not.toBeDisabled()
    await expect(again).toHaveAccessibleDescription('최신 내용을 불러온 뒤에 환불할 수 있어요')
    await userEvent.click(again)
    await expect(screen.queryByRole('dialog')).toBeNull() // 눌러도 창이 열리지 않는다
    await expect(sentKeys).toHaveLength(1)
  },
}

/** 환불 중(`PENDING`)으로 끝나도 같다 - 「환불 중이에요: 금액」 */
export const APendingRefundIsSaidAsInProgress: Story = {
  ...withDirect(true, goes('PENDING')),
  play: async ({ canvas, userEvent }) => {
    const dialog = await openDirect(canvas, userEvent)
    await pressRefund(dialog, userEvent)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(canvas.getByRole('status')).toHaveTextContent('환불 중이에요: 3,000원')
  },
}

/**
 * 요청 결정을 **진짜 훅**(`useRefundDecision`)에 이은 정본 - 승인은 `approve` 만, 거절은 `reject` 만 부르고(돈이 나가는 쪽과 안 나가는 쪽),
 * 성공하면 창이 닫힌다. 승인이 결제사에 거절되면(402) 요청이 닫혔다고 말하고 확인이 막힌다. 일하는 동안 × 로 닫았다가 다시 열어도 일하는 중이다.
 */
const decided: Array<[string, string]> = []
type Behavior = () => Promise<Refund>
let approveBehavior: Behavior[] = []
let rejectBehavior: Behavior[] = []
const decisionApi = {
  approveRefund: async (id: string): Promise<Refund> => {
    decided.push(['approve', id])
    const next = approveBehavior.shift()
    return next ? next() : adminRefund({ id, status: 'SUCCEEDED' })
  },
  rejectRefund: async (id: string): Promise<Refund> => {
    decided.push(['reject', id])
    const next = rejectBehavior.shift()
    return next ? next() : adminRefund({ id, status: 'REJECTED' })
  },
} as unknown as PaymentAdminApi

function DecisionPage({ withLink = false }: { withLink?: boolean }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { mutations: { retry: false } } }),
  )
  return (
    <QueryClientProvider client={client}>
      <DecisionButtons withLink={withLink} />
    </QueryClientProvider>
  )
}

/** `onSend` 가 불린 횟수 - 승인 · 거절을 보내는 순간마다 한 번 */
let decisionSends = 0

function DecisionButtons({ withLink }: { withLink: boolean }) {
  const decision = useRefundDecision(decisionApi, {
    labels: koPaymentLabels,
    locale: 'ko-KR',
    onSend: () => {
      decisionSends += 1
    },
    ...(withLink
      ? {
          orderLink: (refund: AdminRefund, className: string) => (
            <a className={className} href={`#/admin/payments/${refund.orderId}`}>
              결제 보기
            </a>
          ),
        }
      : {}),
  })
  return (
    <>
      <Button variant="secondary" onClick={() => decision.start('approve', request, 3000)}>
        환불 열기
      </Button>
      <Button variant="secondary" onClick={() => decision.start('reject', request, 3000)}>
        거절 열기
      </Button>
      {decision.dialog}
    </>
  )
}

const withDecisions = (...behaviors: Behavior[]) => ({
  beforeEach: () => {
    decided.length = 0
    decisionSends = 0
    approveBehavior = [...behaviors]
    rejectBehavior = []
  },
})

export const ApproveCallsOnlyApprove: Story = {
  ...withDecisions(),
  render: () => <DecisionPage />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '환불 열기' }))
    const dialog = await screen.findByRole('dialog', { name: '요청대로 환불할까요?' })
    await userEvent.click(within(dialog).getByRole('button', { name: '환불하기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(decided).toEqual([['approve', request.id]]) // 거절은 부르지 않았다
  },
}

/** 보내는 순간 알린다 - 답이 유실돼 결과를 몰라도(승인은 돈이 나갔을 수 있다) 한 번, 거절도 한 번. 같은 확인을 다시 눌러 보내면 보낸 만큼 다시 알린다 */
export const ASendIsReportedTheMomentItGoesOutEvenWhenTheAnswerIsLost: Story = {
  ...withDecisions(lost),
  render: () => <DecisionPage />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '환불 열기' }))
    const dialog = await screen.findByRole('dialog', { name: '요청대로 환불할까요?' })
    await userEvent.click(within(dialog).getByRole('button', { name: '환불하기' }))
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '환불 결과를 확인하지 못했어요',
    )
    await expect(decisionSends).toBe(1) // 성공하지 못했는데도 보낸 순간 알렸다
    await userEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await userEvent.click(canvas.getByRole('button', { name: '거절 열기' }))
    const reject = await screen.findByRole('dialog', { name: '환불 요청을 거절할까요?' })
    await userEvent.click(within(reject).getByRole('button', { name: '거절하기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(decisionSends).toBe(2)
  },
}

export const DeclineCallsOnlyReject: Story = {
  ...withDecisions(),
  render: () => <DecisionPage />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '거절 열기' }))
    const dialog = await screen.findByRole('dialog', { name: '환불 요청을 거절할까요?' })
    await userEvent.click(within(dialog).getByRole('button', { name: '거절하기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(decided).toEqual([['reject', request.id]]) // 돈이 나가는 승인은 부르지 않았다
  },
}

/** 결제사가 승인을 거절하면 그 요청 줄은 닫힌다 - 같은 요청을 다시 보내지 않고, 결제 한 건으로 가는 길이 있다 */
export const AnApprovalTheProviderRefusesLeavesAWayToThePayment: Story = {
  ...withDecisions(answers('PAYMENT.REFUND_DECLINED', 402, { category: 'TEMPORARY' })),
  render: () => <DecisionPage withLink />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '환불 열기' }))
    let dialog = await screen.findByRole('dialog', { name: '요청대로 환불할까요?' })
    await userEvent.click(within(dialog).getByRole('button', { name: '환불하기' }))
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '요청은 환불 안 됨으로 닫혔어요. 결제 한 건에서 직접 환불해 주세요',
    )
    const orderLink = within(dialog).getByRole('link', { name: '결제 보기' })
    await expect(orderLink).toHaveAttribute('href', '#/admin/payments/ord_1')
    await expectButtonLike(orderLink)
    // 다시 눌러도 같은 요청을 또 보내지 않는다 - 그 줄은 닫혔다
    await userEvent.click(within(dialog).getByRole('button', { name: '환불하기' }))
    await expect(decided).toEqual([['approve', request.id]])
    // 닫고 다시 열면 묵은 오류가 없다
    await userEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await userEvent.click(canvas.getByRole('button', { name: '환불 열기' }))
    dialog = await screen.findByRole('dialog', { name: '요청대로 환불할까요?' })
    await expect(within(dialog).queryByRole('alert')).toBeNull()
  },
}

export const ALostApprovalAnswerThenASecondPressIsToldNeutrally: Story = {
  ...withDecisions(lost, answers('PAYMENT.REFUND_NOT_ALLOWED', 409)),
  render: () => <DecisionPage withLink />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '환불 열기' }))
    const dialog = await screen.findByRole('dialog', { name: '요청대로 환불할까요?' })
    await userEvent.click(within(dialog).getByRole('button', { name: '환불하기' }))
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '환불 결과를 확인하지 못했어요',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '환불하기' }))
    await waitFor(() =>
      expect(within(dialog).getByRole('alert')).toHaveTextContent(
        '지금은 이 요청대로 환불할 수 없어요. 결제 한 건에서 상태를 확인해 주세요',
      ),
    )
    await expectButtonLike(within(dialog).getByRole('link', { name: '결제 보기' }))
    await expect(within(dialog).getByRole('button', { name: '환불하기' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await expect(decided).toHaveLength(2)
  },
}

/** × 로 닫았다가 다시 열어도 일하는 중이다 - 풀린 확인을 또 눌러 승인이 두 번 나가지 않는다 */
export const ReopeningWhileSendingKeepsItBusy: Story = {
  beforeEach: () => {
    decided.length = 0
  },
  render: () => <DecisionPage />,
  play: async ({ canvas, userEvent }) => {
    let release: () => void = () => undefined
    approveBehavior = [
      () =>
        new Promise<Refund>((resolve) => {
          release = () => resolve(adminRefund({ id: request.id, status: 'SUCCEEDED' }))
        }),
    ]
    await userEvent.click(canvas.getByRole('button', { name: '환불 열기' }))
    const dialog = await screen.findByRole('dialog', { name: '요청대로 환불할까요?' })
    await userEvent.click(within(dialog).getByRole('button', { name: '환불하기' }))
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /환불하는 중/ })).toBeDisabled(),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '창 닫기' })) // ×
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await userEvent.click(canvas.getByRole('button', { name: '환불 열기' }))
    const again = await screen.findByRole('dialog', { name: '요청대로 환불할까요?' })
    await expect(within(again).getByRole('button', { name: /환불하는 중/ })).toBeDisabled()
    await userEvent.click(within(again).getByRole('button', { name: /환불하는 중/ }))
    await expect(decided).toEqual([['approve', request.id]]) // 두 번 나가지 않았다
    release()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(decided).toHaveLength(1)
  },
}

/**
 * 승인이 나갔는데 화면을 다시 읽지 못했다면 - 요청 줄은 `REQUESTED` 그대로 보이지만, 나간 환불을 상태 글자로 말하고 「요청대로 환불하기」를 막는다
 * (같은 단추를 또 누르지 않게). 「요청 거절하기」는 돈이 안 나가니 열려 있다.
 */
function ApprovedScreen() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { mutations: { retry: false } } }),
  )
  return (
    <QueryClientProvider client={client}>
      <ApprovedPanel />
    </QueryClientProvider>
  )
}

function ApprovedPanel() {
  const decision = useRefundDecision(decisionApi, { labels: koPaymentLabels, locale: 'ko-KR' })
  const o = adminOrder({ refundPending: true, openRefundStatus: 'REQUESTED' })
  return (
    <>
      <AdminOrderPanel
        detail={{ order: o, refunds: [request], events: [] }}
        onApprove={(line) => decision.start('approve', line, 3000)}
        onReject={(line) => decision.start('reject', line, 3000)}
        refunded={decision.approved}
        stale={decision.approved !== undefined}
        labels={koPaymentLabels}
        locale="ko-KR"
        formatTime={() => '2026. 1. 1.'}
      />
      {decision.dialog}
    </>
  )
}

export const AnApprovalThatWentOutIsSaidAndTheOldScreenCannotApproveItAgain: Story = {
  ...withDecisions(),
  render: () => <ApprovedScreen />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /^요청대로 환불하기/ }))
    const dialog = await screen.findByRole('dialog', { name: '요청대로 환불할까요?' })
    await userEvent.click(within(dialog).getByRole('button', { name: '환불하기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(canvas.getByRole('status')).toHaveTextContent('환불했어요: 3,000원')
    const approve = canvas.getByRole('button', { name: /^요청대로 환불하기/ })
    await expect(approve).toHaveAttribute('aria-disabled', 'true')
    await expect(approve).not.toBeDisabled()
    await expect(approve).toHaveAccessibleDescription('최신 내용을 불러온 뒤에 환불할 수 있어요')
    await userEvent.click(approve)
    await expect(screen.queryByRole('dialog')).toBeNull()
    await expect(decided).toEqual([['approve', request.id]]) // 두 번 나가지 않았다
    await expect(canvas.getByRole('button', { name: /^요청 거절하기/ })).not.toHaveAttribute(
      'aria-disabled',
    )
  },
}

/** 일하는 중에 × 로 닫은 뒤 승인이 오류로 끝나면 창이 다시 열려 그 말을 한다 - 닫힌 창에서 끝난 거절이 성공처럼 보이지 않게(요청 탭에서는 줄이 그대로이거나 사라져 구별이 안 된다) */
export const AnApprovalThatEndsInRefusalWhileTheWindowIsClosedOpensItAgain: Story = {
  beforeEach: () => {
    decided.length = 0
  },
  render: () => <DecisionPage withLink />,
  play: async ({ canvas, userEvent }) => {
    let refuse: () => void = () => undefined
    approveBehavior = [
      () =>
        new Promise<Refund>((_resolve, reject) => {
          refuse = () => reject(failure('PAYMENT.REFUND_DECLINED', 402, { category: 'TEMPORARY' }))
        }),
    ]
    await userEvent.click(canvas.getByRole('button', { name: '환불 열기' }))
    const dialog = await screen.findByRole('dialog', { name: '요청대로 환불할까요?' })
    await userEvent.click(within(dialog).getByRole('button', { name: '환불하기' }))
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /환불하는 중/ })).toBeDisabled(),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '창 닫기' })) // ×
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    refuse()
    const again = await screen.findByRole('dialog', { name: '요청대로 환불할까요?' })
    await expect(within(again).getByRole('alert')).toHaveTextContent(
      '요청은 환불 안 됨으로 닫혔어요',
    )
  },
}

/** 거절도 같다 - 닫힌 창에서 오류로 끝나면 다시 열려 말한다 */
export const ADeclineThatFailsWhileTheWindowIsClosedOpensItAgain: Story = {
  beforeEach: () => {
    decided.length = 0
    rejectBehavior = []
  },
  render: () => <DecisionPage />,
  play: async ({ canvas, userEvent }) => {
    let fail: () => void = () => undefined
    rejectBehavior = [
      () =>
        new Promise<Refund>((_resolve, reject) => {
          fail = () => reject(failure('PAYMENT.REFUND_NOT_FOUND', 404))
        }),
    ]
    await userEvent.click(canvas.getByRole('button', { name: '거절 열기' }))
    const dialog = await screen.findByRole('dialog', { name: '환불 요청을 거절할까요?' })
    await userEvent.click(within(dialog).getByRole('button', { name: '거절하기' }))
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /거절하는 중/ })).toBeDisabled(),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '창 닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fail()
    const again = await screen.findByRole('dialog', { name: '환불 요청을 거절할까요?' })
    await expect(within(again).getByRole('alert')).toHaveTextContent('거절하지 못했어요')
  },
}

/** 일하는 중에 닫은 창이 성공으로 끝나면 그대로 닫혀 있다(다시 열지 않는다) */
export const AnApprovalThatSucceedsWhileTheWindowIsClosedStaysClosed: Story = {
  beforeEach: () => {
    decided.length = 0
  },
  render: () => <DecisionPage />,
  play: async ({ canvas, userEvent }) => {
    let release: () => void = () => undefined
    approveBehavior = [
      () =>
        new Promise<Refund>((resolve) => {
          release = () => resolve(adminRefund({ id: request.id, status: 'SUCCEEDED' }))
        }),
    ]
    await userEvent.click(canvas.getByRole('button', { name: '환불 열기' }))
    const dialog = await screen.findByRole('dialog', { name: '요청대로 환불할까요?' })
    await userEvent.click(within(dialog).getByRole('button', { name: '환불하기' }))
    await userEvent.click(within(dialog).getByRole('button', { name: '창 닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    release()
    await waitFor(() => expect(decided).toHaveLength(1))
    await new Promise((resolve) => setTimeout(resolve, 100))
    await expect(screen.queryByRole('dialog')).toBeNull()
  },
}

export const English: Story = {
  args: { open: true, labels: undefined, locale: 'en-US' },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: 'Refund this payment?' })
    await expect(within(dialog).getByRole('button', { name: 'Refund' })).toBeVisible()
    await expect(within(dialog).getByRole('button', { name: 'Close' })).toBeVisible()
    await expect(within(dialog).getByLabelText('Amount to refund')).toHaveValue('3000')
  },
}

/** 320px · 375px — 모달은 뷰포트에 붙으니 틀 안에 가두지 않고 뷰포트 자체를 바꾼다(`globals.viewport`). 오류 · 긴 참조 번호까지 띄운 가장 긴 모양이 가로로 밀리지 않는다 */
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

const longReference = failure('PAYMENT.REFUND_DECLINED', 402, {
  category: 'ALREADY_REFUNDED',
  providerCode: 'ALREADY_CANCELED_PAYMENT_WITH_A_VERY_LONG_NAME',
})

export const At320: Story = {
  parameters: { viewport: viewports },
  globals: { viewport: { value: 'w320', isRotated: false } },
  args: { open: true, error: longReference },
  play: () => expectNoSidewaysScroll(320),
}

export const At375: Story = {
  parameters: { viewport: viewports },
  globals: { viewport: { value: 'w375', isRotated: false } },
  args: { open: true, error: longReference },
  play: () => expectNoSidewaysScroll(375),
}

/** 구독 결제의 환불 창은 「전액 환불되면 구독도 해지」를 켠 채 시작한다 - 끄면 `endSubscription: false` 가 함께 나간다(켠 채면 싣지 않는다 = 지금 동작) */
export const SubscriptionChargeCanKeepTheSubscription: Story = {
  render: () => <Demo order={order({ kind: 'SUBSCRIPTION_RENEWAL' })} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '열기' }))
    const dialog = await screen.findByRole('dialog', { name: directName })
    const box = within(dialog).getByRole('checkbox', { name: '전액 환불되면 구독도 해지' })
    await expect(box).toBeChecked()
    await expect(box).toHaveAccessibleDescription(
      '지금 기간 결제를 전액 환불할 때만 적용돼요. 끄면 다음 결제일에 계속 결제돼요',
    )
    await userEvent.click(box)
    await expect(box).not.toBeChecked()
    await userEvent.click(within(dialog).getByRole('button', { name: '환불하기' }))
    await expect(onConfirm).toHaveBeenCalledWith({
      reasonCode: 'OPERATOR',
      amount: 3000,
      endSubscription: false,
    })
  },
}

export const SubscriptionChargeLeftOnSendsNothingExtra: Story = {
  render: () => <Demo order={order({ kind: 'SUBSCRIPTION_INITIAL' })} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '열기' }))
    const dialog = await screen.findByRole('dialog', { name: directName })
    await userEvent.click(within(dialog).getByRole('button', { name: '환불하기' }))
    await expect(onConfirm).toHaveBeenCalledWith({ reasonCode: 'OPERATOR', amount: 3000 })
  },
}

/** 구독 결제가 아니면 선택이 없다 - 한 번 결제에는 해지할 구독이 없다 */
export const NoChoiceForAOneTimePayment: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '열기' }))
    const dialog = await screen.findByRole('dialog', { name: directName })
    await expect(within(dialog).queryByRole('checkbox')).toBeNull()
  },
}

/** 이 결제사는 서버에서 환불을 못 한다(409 `REFUND_UNSUPPORTED`) - 결제사를 부르기 전에 나간 답이라 확인이 막히고 할 일을 말한다 */
export const ProviderCannotRefundFromTheServer: Story = {
  render: () => <Demo error={failure('PAYMENT.REFUND_UNSUPPORTED')} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '열기' }))
    const dialog = await screen.findByRole('dialog', { name: directName })
    await expect(dialog).toHaveTextContent(
      '이 결제사는 서버에서 환불할 수 없어요. 결제사 관리 화면에서 환불한 뒤 요청을 거절해 주세요',
    )
    await expectBlockedButReachable(dialog, '결제사 관리 화면에서 환불')
  },
}
