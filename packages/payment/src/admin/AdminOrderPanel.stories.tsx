import type { Meta, StoryObj } from '@storybook/react-vite'
import { ApiRequestError } from '@skeleton/api-client'
import { expect, fn, within } from 'storybook/test'
import { koPaymentLabels } from '../labels'
import { adminOrder, adminRefund, paymentEvent } from '../test/fixtures'
import { AdminOrderPanel } from './AdminOrderPanel'
import type { AdminOrderDetail } from './types'

/**
 * 운영자의 결제 한 건 — 이름 · 상태 · 결제 번호 · 계정 · 결제사와 그 결제 번호 · 금액 · 카드 표시 · 시각, 확인 필요면 이유와 다음 걸음,
 * 환불 줄(기다리는 요청 옆에 「요청대로 환불하기」 · 「요청 거절하기」), 이력, 그리고 「환불하기」(직접) · 「결제사와 맞추기」.
 * **채운 단추는 화면에 하나뿐** — 상태마다 가장 중요한 행동 하나: 기다리는 요청이 있으면 그 결정(「요청대로 환불하기」), 아니면 확인 필요의 「결제사와 맞추기」,
 * 아니면 「환불하기」(환불이 막혔으면 「결제사와 맞추기」). 상태별 스토리 `play` 가 채운 단추 수를 센다. 못 누르는 「환불하기」(요청이 열려 있음 · 환불 중)는 흐리게 두고
 * 이유를 옆에 적는다(`aria-disabled` + `aria-describedby` — Tab 으로 닿고 눌러도 아무 일 없다). 돈이 나가는 단추는 부모가 확인 창을 거쳐 부른다.
 */
const events = [
  paymentEvent({
    id: 1,
    type: 'ORDER_CREATED',
    fromStatus: null,
    toStatus: 'PENDING',
    actor: 'USER',
  }),
  paymentEvent({
    id: 2,
    type: 'CONFIRM_STARTED',
    fromStatus: 'PENDING',
    toStatus: 'CONFIRMING',
    actor: 'USER',
  }),
  paymentEvent({ id: 3, type: 'CONFIRM_SUCCEEDED', actor: 'PROVIDER' }),
]
const detail = (over: Partial<AdminOrderDetail> = {}): AdminOrderDetail => ({
  order: adminOrder({ orderName: '응원하기 3,000원' }),
  refunds: [],
  events,
  ...over,
})
/** 화면의 채운 단추 — 「주 행동은 채워진 단추 하나」. 상태마다 이 수를 단정한다 */
const filledButtons = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-variant="primary"]'))
async function expectOneFilled(root: HTMLElement, name: string) {
  const filled = filledButtons(root)
  await expect(filled).toHaveLength(1)
  await expect(filled[0]).toHaveAccessibleName(name)
}

const failure = (code: string, status: number) =>
  new ApiRequestError(
    { code, title: 't', status, timestamp: 't', traceId: 'trace-7' },
    'trace-7',
    'sp',
    'tp',
  )

const meta = {
  title: 'Packages/payment/admin/AdminOrderPanel',
  component: AdminOrderPanel,
  args: {
    detail: detail(),
    onRefund: fn(),
    onApprove: fn(),
    onReject: fn(),
    onSync: fn(),
    labels: koPaymentLabels,
    locale: 'ko-KR',
    formatTime: () => '2026. 1. 1. 오후 12:00',
  },
} satisfies Meta<typeof AdminOrderPanel>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await expect(canvas.getByRole('heading', { name: '응원하기 3,000원' })).toBeVisible()
    for (const [label, value] of [
      ['결제 번호', 'ord_1'],
      ['계정', 'acc_1'],
      ['결제사', 'toss'],
      ['결제사 결제 번호', 'tgen_9f8e7d'],
      ['결제 금액', '3,000원'],
      ['결제 수단', '현대카드 ····1234'],
      ['환불할 수 있는 금액', '3,000원'],
    ] as const) {
      const term = canvas.getByText(label, { selector: 'dt' })
      await expect(term.nextElementSibling).toHaveTextContent(value)
    }
    // 주 행동은 채운 단추 하나: 환불하기. 맞추기는 테두리
    const refund = canvas.getByRole('button', { name: '환불하기' })
    await expect(refund).toHaveAttribute('data-variant', 'primary')
    await expectOneFilled(canvasElement, '환불하기')
    await expect(canvas.getByRole('button', { name: '결제사와 맞추기' })).toHaveAttribute(
      'data-variant',
      'secondary',
    )
    await userEvent.click(refund)
    await expect(args.onRefund).toHaveBeenCalledTimes(1)
    await userEvent.click(canvas.getByRole('button', { name: '결제사와 맞추기' }))
    await expect(args.onSync).toHaveBeenCalledTimes(1)
    // 확인 필요 띠는 없다
    await expect(canvas.queryByText('확인 필요')).toBeNull()
  },
}

export const History: Story = {
  play: async ({ canvas }) => {
    const history = canvas.getByRole('region', { name: '이력' })
    const items = within(history).getAllByRole('listitem')
    await expect(items).toHaveLength(3)
    // 최신 것이 위
    await expect(items[0]).toHaveTextContent('결제가 확인됐어요')
    await expect(items[0]).toHaveTextContent('결제사')
    await expect(items[1]).toHaveTextContent('결제 전 → 결제 확인 중')
    await expect(items[2]).toHaveTextContent('결제를 시작했어요')
    await expect(items[2]).toHaveTextContent('본인')
    await expect(history).not.toHaveTextContent('CONFIRM_SUCCEEDED')
  },
}

/** 돈은 받았는데 지급이 끝내 안 됐다 - 확인 필요 중 가장 먼저 볼 것. 「결제사와 맞추기」는 결제사에 다시 묻는 것이 아니라 그 일을 다시 건다고 말한다. 환불 줄의 우리 쪽 이유 코드(`NOT_APPLIED` …)는 문장으로 읽힌다 */
export const FulfilmentUnresolvedAndTheRefundLinesSaidInWords: Story = {
  args: {
    detail: detail({
      order: adminOrder({ reviewReason: 'FULFILMENT_UNRESOLVED' }),
      refunds: [
        adminRefund({ id: 'rfd_1', status: 'FAILED', failureCode: 'NOT_APPLIED' }),
        adminRefund({
          id: 'rfd_2',
          status: 'WITHDRAWN',
          closedBy: 'SYSTEM',
          failureCode: 'ORDER_REFUNDED',
        }),
      ],
      events: [...events, paymentEvent({ id: 4, type: 'REFUND_APPLIED', actor: 'SYSTEM' })],
    }),
  },
  play: async ({ canvas, canvasElement }) => {
    await expectOneFilled(canvasElement, '결제사와 맞추기')
    const notice = canvas.getByRole('alert')
    await expect(notice).toHaveTextContent('돈은 받았는데 지급이 끝내 안 됐어요')
    await expect(notice).toHaveTextContent('끝나지 않은 그 일을 다시 걸어요')
    await expect(notice).not.toHaveTextContent('결제사에 다시 물어봐요')
    const refunds = canvas.getByRole('region', { name: '환불' })
    await expect(refunds).toHaveTextContent('결제사에서 환불이 적용되지 않았어요')
    await expect(refunds).toHaveTextContent('환불이 끝나 요청이 닫혔어요')
    await expect(refunds).not.toHaveTextContent('NOT_APPLIED')
    await expect(canvas.getByRole('region', { name: '이력' })).toHaveTextContent(
      '환불에 맞춰 지급을 거둬들였어요',
    )
  },
}

/** 확인 필요 — 이유(말로)와 다음 걸음. 이때는 「결제사와 맞추기」가 채운 단추 하나, 「환불하기」는 테두리 */
export const NeedsACheck: Story = {
  args: { detail: detail({ order: adminOrder({ reviewReason: 'REFUND_MISMATCH' }) }) },
  play: async ({ canvas, canvasElement }) => {
    await expectOneFilled(canvasElement, '결제사와 맞추기')
    const notice = canvas.getByRole('alert')
    await expect(notice).toHaveTextContent('확인 필요')
    await expect(notice).toHaveTextContent('환불한 금액이 결제사와 맞지 않아요')
    await expect(notice).toHaveTextContent('「결제사와 맞추기」를 누르면 결제사에 다시 물어봐요.')
    await expect(canvas.getByRole('button', { name: '결제사와 맞추기' })).toHaveAttribute(
      'data-variant',
      'primary',
    )
    await expect(canvas.getByRole('button', { name: '환불하기' })).toHaveAttribute(
      'data-variant',
      'secondary',
    )
    await expect(canvas.queryByText('REFUND_MISMATCH')).toBeNull()
  },
}

/**
 * 오래 남은 것으로 파생된 사유는 「결제사와 맞추기」를 눌러도 안 풀릴 수 있다. 맞춘 뒤에도 남았으면 방금 한 일을 또 하라고 하지 않고 지금 사실을 말한다 -
 * 결제사에 다시 물었지만 남아 있다(→ 결제사 화면에서 확인) / 끝나지 않은 일을 다시 걸었다(→ 끝나면 스스로 사라진다)
 */
export const ADerivedReasonThatStaysAfterMatching: Story = {
  args: {
    detail: detail({
      order: adminOrder({ reviewReason: 'STALE_CONFIRMING', status: 'CONFIRMING' }),
    }),
    synced: { reviewReason: 'STALE_CONFIRMING' },
  },
  play: async ({ canvas }) => {
    const notice = canvas.getByRole('alert')
    await expect(notice).toHaveTextContent('결제 확인 중인 채로 오래 남아 있어요')
    await expect(notice).toHaveTextContent(
      '결제사에 다시 물었지만 아직 남아 있어요. 결제사 화면에서 확인해 주세요',
    )
    await expect(notice).not.toHaveTextContent('누르면')
    await expect(canvas.getByText('결제사와 맞췄어요')).toBeVisible()
  },
}

export const TheUnfinishedJobWasStartedAgain: Story = {
  args: {
    detail: detail({ order: adminOrder({ reviewReason: 'FULFILMENT_UNRESOLVED' }) }),
    synced: { reviewReason: 'FULFILMENT_UNRESOLVED' },
  },
  play: async ({ canvas }) => {
    const notice = canvas.getByRole('alert')
    await expect(notice).toHaveTextContent('돈은 받았는데 지급이 끝내 안 됐어요')
    await expect(notice).toHaveTextContent(
      '끝나지 않은 그 일을 다시 걸었어요. 끝나면 이 표시가 사라져요',
    )
    await expect(notice).not.toHaveTextContent('누르면')
  },
}

/** 탈퇴한 계정의 결제 - 계정 칸의 대체 값 옆에 「탈퇴한 계정」(`TOMBSTONE` 설정의 대체 id) */
export const ClosedAccount: Story = {
  args: { detail: detail({ order: adminOrder({ accountId: 'deleted:3f9a1c0b7d2e4a55' }) }) },
  play: async ({ canvas }) => {
    const account = canvas.getByText('계정').closest('div')!
    await expect(within(account).getByText('탈퇴한 계정')).toBeVisible()
    await expect(within(account).getByText('deleted:3f9a1c0b7d2e4a55')).toBeVisible()
  },
}

/** 기본 설정(`KEEP`)에서는 원래 id 가 그대로다 - 서버가 주는 `accountErasedAt` 이 탈퇴를 말하고, 화면은 그 칸을 먼저 본다 */
export const ClosedAccountFromTheErasedAtField: Story = {
  args: {
    detail: detail({
      order: adminOrder({ accountId: 'acc_1', accountErasedAt: '2026-01-01T00:00:00Z' }),
    }),
  },
  play: async ({ canvas }) => {
    const account = canvas.getByText('계정').closest('div')!
    await expect(within(account).getByText('탈퇴한 계정')).toBeVisible()
    await expect(within(account).getByText('acc_1')).toBeVisible()
  },
}

/** 요청이 기다리는 동안: 직접 환불은 흐리게 — 이유가 옆에 있고 Tab 으로 닿는다. 요청 줄에서 결정한다 */
export const ARequestIsWaiting: Story = {
  args: {
    detail: detail({
      order: adminOrder({ refundPending: true, openRefundStatus: 'REQUESTED' }),
      refunds: [adminRefund({ requestedAt: '2026-01-01T03:00:00Z' })],
    }),
  },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    // 기다리는 요청이 있으면 그 결정이 채운 단추 하나 - 흐린 「환불하기」는 테두리
    await expectOneFilled(canvasElement, '요청대로 환불하기: 3,000원 (결제 ord_1)')
    const refund = canvas.getByRole('button', { name: '환불하기' })
    await expect(refund).toHaveAttribute('data-variant', 'secondary')
    await expect(refund).toHaveAttribute('aria-disabled', 'true')
    await expect(refund).not.toBeDisabled()
    await expect(refund).toHaveAccessibleDescription(
      '환불 요청이 있어요. 아래에서 환불하거나 거절해 주세요',
    )
    await userEvent.click(refund)
    await expect(args.onRefund).not.toHaveBeenCalled()
    await userEvent.tab()
    // 요청 줄의 결정 단추
    const approve = canvas.getByRole('button', {
      name: '요청대로 환불하기: 3,000원 (결제 ord_1)',
    })
    await expect(approve).toHaveAttribute('data-variant', 'primary')
    await userEvent.click(approve)
    await expect(args.onApprove).toHaveBeenCalledWith(args.detail.refunds[0])
    const reject = canvas.getByRole('button', { name: '요청 거절하기: 3,000원 (결제 ord_1)' })
    await expect(reject).toHaveAttribute('data-variant', 'secondary')
    await userEvent.click(reject)
    await expect(args.onReject).toHaveBeenCalledWith(args.detail.refunds[0])
    await expect(canvas.getAllByText('환불 요청함').length).toBeGreaterThan(0)
  },
}

export const RefundInProgress: Story = {
  args: {
    detail: detail({
      order: adminOrder({ refundPending: true, openRefundStatus: 'PENDING' }),
      refunds: [adminRefund({ status: 'PENDING', origin: 'OPERATOR', reasonCode: 'OPERATOR' })],
    }),
  },
  play: async ({ canvas, canvasElement }) => {
    // 환불이 나가는 중이라 직접 환불은 막혔다 - 눌러 볼 수 있는 다음 걸음 「결제사와 맞추기」가 채운 단추
    await expectOneFilled(canvasElement, '결제사와 맞추기')
    await expect(canvas.getByRole('button', { name: '환불하기' })).toHaveAccessibleDescription(
      '환불 중이에요',
    )
    // 진행 중인 줄에는 결정 단추가 없다
    await expect(canvas.queryByRole('button', { name: /요청대로 환불하기/ })).toBeNull()
  },
}

/** 돈이 결제사와 어긋났다 - 서버가 환불을 409 로 막으니 돈이 나가는 두 단추는 흐리게(닿고 이유가 설명) 막히고, 채운 단추는 「결제사와 맞추기」 하나. 거절은 돈이 안 나가 살아 있다 */
export const MoneyOffHoldsTheRefundsUntilMatched: Story = {
  args: {
    detail: detail({
      order: adminOrder({
        reviewReason: 'REFUND_MISMATCH',
        refundPending: true,
        openRefundStatus: 'REQUESTED',
      }),
      refunds: [adminRefund()],
    }),
  },
  play: async ({ canvas, canvasElement }) => {
    await expectOneFilled(canvasElement, '결제사와 맞추기')
    const approve = canvas.getByRole('button', { name: /^요청대로 환불하기/ })
    await expect(approve).toHaveAttribute('aria-disabled', 'true')
    await expect(approve).not.toBeDisabled()
    await expect(approve).toHaveAccessibleDescription('먼저 결제사와 맞춰 주세요')
    await expect(canvas.getByRole('button', { name: /^요청 거절하기/ })).not.toHaveAttribute(
      'aria-disabled',
    )
  },
}

/** 직접 환불도 같다 - 확인 필요가 돈이 어긋난 것이면 「환불하기」가 이유와 함께 막힌다 */
export const MoneyOffHoldsTheDirectRefund: Story = {
  args: { detail: detail({ order: adminOrder({ reviewReason: 'REFUND_MISMATCH' }) }) },
  play: async ({ canvas, canvasElement }) => {
    await expectOneFilled(canvasElement, '결제사와 맞추기')
    const refund = canvas.getByRole('button', { name: '환불하기' })
    await expect(refund).toHaveAttribute('aria-disabled', 'true')
    await expect(refund).not.toBeDisabled()
    await expect(refund).toHaveAccessibleDescription('먼저 결제사와 맞춰 주세요')
  },
}

/** 맞추기 단추가 없는 조립에서는 서버가 막는 사유(`REFUND_MISMATCH`)만 환불을 막고, 문구도 없는 단추로 보내지 않는다 - 「먼저 결제사와 맞춰 주세요」가 아니라 「결제사와 어긋나 있어 환불할 수 없어요」 */
export const MoneyOffWithoutSyncSaysItCannotRefund: Story = {
  args: {
    detail: detail({ order: adminOrder({ reviewReason: 'REFUND_MISMATCH' }) }),
    onSync: undefined,
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button', { name: '결제사와 맞추기' })).toBeNull()
    const refund = canvas.getByRole('button', { name: '환불하기' })
    await expect(refund).toHaveAttribute('aria-disabled', 'true')
    await expect(refund).toHaveAccessibleDescription('결제사와 어긋나 있어 환불할 수 없어요')
  },
}

/** 맞춘 뒤에도 돈이 어긋나 있으면 방금 한 일을 또 하라고 하지 않는다 - 맞춰 봤지만 아직 어긋났다고, 결제사 화면에서 확인하라고 말한다 */
export const StillOffAfterMatchingSaysSo: Story = {
  args: {
    detail: detail({ order: adminOrder({ reviewReason: 'REFUND_MISMATCH' }) }),
    synced: { reviewReason: 'REFUND_MISMATCH' },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('결제사와 맞췄어요')).toBeVisible()
    await expect(canvas.getByRole('button', { name: '환불하기' })).toHaveAccessibleDescription(
      '맞춰 봤지만 아직 어긋나 있어요. 결제사 화면에서 확인해 주세요',
    )
  },
}

/**
 * 맞춘 뒤에 **새로 생긴** 사유 - 맞추기(깨끗함) → 직접 환불 → 결제사가 다른 금액으로 답함 → `REFUND_MISMATCH`.
 * 그 사유는 아무도 결제사에 묻지 않았으니 「맞춰 봤지만 아직 어긋나 있어요」가 아니라 처음의 말이고, 출구인 「결제사와 맞추기」가 채운 단추로 남는다
 */
export const AReasonThatAppearedAfterMatchingIsStillToBeMatched: Story = {
  args: {
    detail: detail({ order: adminOrder({ reviewReason: 'REFUND_MISMATCH' }) }),
    synced: { reviewReason: null },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.queryByText('결제사와 맞췄어요')).toBeNull()
    const notice = canvas.getByRole('alert')
    await expect(notice).toHaveTextContent('환불한 금액이 결제사와 맞지 않아요')
    await expect(notice).toHaveTextContent('누르면 결제사에 다시 물어봐요')
    await expect(notice).not.toHaveTextContent('아직 남아 있어요')
    await expect(canvas.getByRole('button', { name: '환불하기' })).toHaveAccessibleDescription(
      '먼저 결제사와 맞춰 주세요',
    )
    const filled = filledButtons(canvasElement)
    await expect(filled).toHaveLength(1)
    await expect(filled[0]).toHaveAccessibleName('결제사와 맞추기')
  },
}

/** 닫힌 줄에 환불됨 응답이 늦게 왔다 - 「환불 안 됨」 옆에 돈이 나갔을 수 있다고 말하고, 이력은 「환불 결과를 아직 몰라요」가 아니라 일어난 일을 말한다 */
export const ALateResultIsSaidAsMoneyThatMayHaveGoneOut: Story = {
  args: {
    detail: detail({
      order: adminOrder({ reviewReason: 'REFUND_MISMATCH' }),
      refunds: [adminRefund({ id: 'rfd_1', status: 'FAILED', failureCode: 'LATE_RESULT' })],
      events: [
        paymentEvent({
          id: 9,
          refundId: 'rfd_1',
          type: 'REFUND_UNKNOWN',
          actor: 'OPERATOR',
          fromStatus: 'FAILED',
          toStatus: 'FAILED',
          providerCode: 'LATE_RESULT',
        }),
        paymentEvent({
          id: 10,
          refundId: 'rfd_1',
          type: 'REFUND_FAILED',
          actor: 'SYSTEM',
          fromStatus: 'PENDING',
          toStatus: 'FAILED',
          providerCode: 'PROVIDER_PENDING_EXPIRED',
        }),
      ],
    }),
  },
  play: async ({ canvas }) => {
    const refunds = canvas.getByRole('region', { name: '환불' })
    await expect(refunds).toHaveTextContent('환불된 금액을 확인해 주세요')
    await expect(refunds).not.toHaveTextContent('LATE_RESULT')
    const history = canvas.getByRole('region', { name: '이력' })
    await expect(history).toHaveTextContent('닫힌 뒤에 결제사의 환불 결과가 도착했어요')
    await expect(history).not.toHaveTextContent('환불 결과를 아직 몰라요')
    await expect(history).toHaveTextContent('결제사가 정해진 시간 안에 끝내지 못해 닫혔어요')
    await expect(history).not.toHaveTextContent('LATE_RESULT')
    await expect(history).not.toHaveTextContent('PROVIDER_PENDING_EXPIRED')
  },
}

/** 확인 필요이면서 요청도 기다린다(결과를 못 정함 - 돈이 어긋난 것은 아니다) - 우선순위는 요청의 결정이 먼저, 맞추기는 테두리 */
export const NeedsACheckAndARequestIsWaiting: Story = {
  args: {
    detail: detail({
      order: adminOrder({
        reviewReason: 'CONFIRM_UNRESOLVED',
        refundPending: true,
        openRefundStatus: 'REQUESTED',
      }),
      refunds: [adminRefund()],
    }),
  },
  play: async ({ canvas, canvasElement }) => {
    await expectOneFilled(canvasElement, '요청대로 환불하기: 3,000원 (결제 ord_1)')
    await expect(canvas.getByRole('button', { name: '결제사와 맞추기' })).toHaveAttribute(
      'data-variant',
      'secondary',
    )
  },
}

export const PartiallyRefunded: Story = {
  args: {
    detail: detail({
      order: adminOrder({
        status: 'PARTIALLY_REFUNDED',
        refundedAmount: 1000,
        refundableAmount: 2000,
      }),
      refunds: [
        adminRefund({
          status: 'SUCCEEDED',
          origin: 'OPERATOR',
          reasonCode: 'OPERATOR',
          amount: { amount: 1000, currency: 'KRW' },
          completedAt: '2026-01-02T03:00:00Z',
        }),
      ],
    }),
  },
  play: async ({ canvas, canvasElement }) => {
    await expectOneFilled(canvasElement, '환불하기')
    await expect(canvas.getAllByText('일부 환불됨').length).toBeGreaterThan(0)
    const refunds = canvas.getByRole('region', { name: '환불' })
    await expect(refunds).toHaveTextContent('1,000원')
    await expect(refunds).toHaveTextContent('운영자')
    await expect(refunds).toHaveTextContent('운영자가 환불함')
    await expect(canvas.getByRole('button', { name: '환불하기' })).not.toHaveAttribute(
      'aria-disabled',
    )
  },
}

/** 다 환불했거나 결제가 안 된 건에는 「환불하기」가 없다 */
export const NothingToRefund: Story = {
  args: {
    detail: detail({
      order: adminOrder({
        status: 'REFUNDED',
        refundedAmount: 3000,
        refundableAmount: 0,
        failureCode: null,
      }),
    }),
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.queryByRole('button', { name: '환불하기' })).toBeNull()
    await expectOneFilled(canvasElement, '결제사와 맞추기') // 눌러 볼 것이 맞추기뿐이면 그것이 채운 단추
    await expect(canvas.getByRole('button', { name: '결제사와 맞추기' })).toBeVisible()
  },
}

export const NotPaid: Story = {
  args: {
    detail: detail({
      order: adminOrder({
        status: 'FAILED',
        refundableAmount: 0,
        failureCode: 'REJECT_CARD_COMPANY',
        paidAt: null,
        card: null,
        method: null,
        providerPaymentId: null,
      }),
      events: [],
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText('결제 안 됨').length).toBeGreaterThan(0)
    await expect(canvas.getByText('REJECT_CARD_COMPANY')).toBeVisible() // 참조 번호 안에서만
    await expect(canvas.queryByText('결제사 결제 번호', { selector: 'dt' })).toBeNull()
    await expect(canvas.getByText('아직 이력이 없어요')).toBeVisible()
  },
}

export const TestPayment: Story = {
  args: { detail: detail({ order: adminOrder({ testMode: true }) }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('테스트 결제예요. 실제로 돈이 나가지 않아요')).toBeVisible()
  },
}

export const Syncing: Story = {
  args: { syncing: true },
  play: async ({ canvas }) => {
    const sync = canvas.getByRole('button', { name: /맞추는 중/ })
    await expect(sync).toBeDisabled()
    await expect(canvas.queryByText('Loading')).toBeNull()
  },
}

export const Synced: Story = {
  args: { synced: { reviewReason: null } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('결제사와 맞췄어요')
  },
}

export const SyncFailedSaysWhy: Story = {
  args: { syncError: failure('PAYMENT.CAPABILITY_UNSUPPORTED', 400) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('이 결제사는 조회를 지원하지 않아요')).toBeVisible()
    await expect(canvas.getByText('trace-7')).toBeVisible()
  },
}

/** 이력의 코드는 참조 번호 안에서만 — 이 패키지가 모르는 종류는 코드를 그리지 않는다 */
export const HistoryWithCodes: Story = {
  args: {
    detail: detail({
      events: [
        paymentEvent({
          id: 1,
          type: 'REFUND_SENT',
          refundId: 'rfd_1',
          fromStatus: 'REQUESTED',
          toStatus: 'PENDING',
          actor: 'OPERATOR',
          providerCode: 'ALREADY_CANCELED_PAYMENT',
          traceId: 'trace-42',
        }),
        paymentEvent({ id: 2, type: 'SOMETHING_NEW', fromStatus: null, toStatus: null }),
      ],
    }),
  },
  play: async ({ canvas }) => {
    const history = canvas.getByRole('region', { name: '이력' })
    await expect(history).toHaveTextContent('환불 요청함 → 환불 중') // 환불 줄의 일은 환불 낱말로
    await expect(within(history).getByText('ALREADY_CANCELED_PAYMENT / trace-42')).toBeVisible()
    await expect(history).toHaveTextContent('기록이 있어요')
    await expect(history).not.toHaveTextContent('SOMETHING_NEW')
  },
}

/** 손댈 것이 없는 읽기 전용 — 단추가 하나도 없다 */
export const ReadOnly: Story = {
  args: { onRefund: undefined, onApprove: undefined, onReject: undefined, onSync: undefined },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.queryAllByRole('button')).toHaveLength(0)
    await expect(filledButtons(canvasElement)).toHaveLength(0)
  },
}

export const English: Story = {
  args: {
    labels: undefined,
    locale: 'en-US',
    detail: detail({ order: adminOrder({ reviewReason: 'MODE_MISMATCH' }) }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Match with the provider' })).toBeVisible()
    await expect(canvas.getByText('Test and real payments got mixed up')).toBeVisible()
    await expect(canvas.getByRole('region', { name: 'History' })).toBeVisible()
  },
}

function InFrame({ width }: { width: string }) {
  return (
    <div data-testid="frame" style={{ width }}>
      <AdminOrderPanel
        detail={detail({
          order: adminOrder({
            orderName: '아주 긴 이름의 응원하기 항목 '.repeat(3),
            reviewReason: 'CONFIRM_UNRESOLVED',
            refundPending: true,
            openRefundStatus: 'REQUESTED',
          }),
          refunds: [adminRefund()],
        })}
        onRefund={() => undefined}
        onApprove={() => undefined}
        onReject={() => undefined}
        onSync={() => undefined}
        labels={koPaymentLabels}
        locale="ko-KR"
        formatTime={() => '2026. 1. 1. 오후 12:00'}
      />
    </div>
  )
}

/** 320px · 375px — 가로 스크롤 없이 접힌다 */
export const At320: Story = {
  render: () => <InFrame width="20rem" />,
  play: async ({ canvas }) => {
    const frame = canvas.getByTestId('frame')
    await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth)
  },
}

export const At375: Story = {
  render: () => <InFrame width="23.4375rem" />,
  play: async ({ canvas }) => {
    const frame = canvas.getByTestId('frame')
    await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth)
  },
}

/** 서버가 이 결제사로는 환불을 못 보낸다고 알렸다 - 「환불하기」와 「요청대로 환불하기」가 흐리게 막히고 이유가 설명으로 읽힌다. 「요청 거절하기」는 열려 있다 */
export const ProviderCannotRefundFromTheServer: Story = {
  args: {
    detail: detail({
      order: adminOrder({ orderName: '응원하기 3,000원', refundBlock: 'UNSUPPORTED' }),
      refunds: [adminRefund({ status: 'REQUESTED' })],
    }),
    onRefund: fn(),
    onApprove: fn(),
    onReject: fn(),
  },
  play: async ({ canvas, args, userEvent }) => {
    const reason =
      '이 결제사는 서버에서 환불할 수 없어요 — 결제사 관리 화면에서 환불한 뒤 요청을 거절하세요'
    const refund = canvas.getByRole('button', { name: '환불하기' })
    await expect(refund).toHaveAttribute('aria-disabled', 'true')
    const approve = canvas.getByRole('button', { name: /^요청대로 환불하기/ })
    await expect(approve).toHaveAttribute('aria-disabled', 'true')
    await expect(approve).toHaveAccessibleDescription(reason)
    await userEvent.click(refund)
    await userEvent.click(approve)
    await expect(args.onRefund).not.toHaveBeenCalled()
    await expect(args.onApprove).not.toHaveBeenCalled()
    await userEvent.click(canvas.getByRole('button', { name: /^요청 거절하기/ }))
    await expect(args.onReject).toHaveBeenCalled()
  },
}

/** 차지백(구매자가 카드사에 이의를 제기해 결제사가 돈을 가져간 환불 줄)과, 분쟁에서 이겨 되돌려진 줄 - 말로 적고 코드는 보이지 않는다. 이력에도 「분쟁에서 이겨 환불이 되돌려졌어요」 */
export const ChargebackAndWonDispute: Story = {
  args: {
    detail: detail({
      order: adminOrder({
        orderName: '응원하기 3,000원',
        status: 'PARTIALLY_REFUNDED',
        refundedAmount: 1000,
        refundableAmount: 2000,
      }),
      refunds: [
        adminRefund({
          id: 'rfd_cb1',
          status: 'SUCCEEDED',
          origin: 'PROVIDER',
          reasonCode: 'CHARGEBACK',
          amount: { amount: 1000, currency: 'KRW' },
        }),
        adminRefund({
          id: 'rfd_cb2',
          status: 'REVERSED',
          origin: 'PROVIDER',
          reasonCode: 'CHARGEBACK',
          amount: { amount: 500, currency: 'KRW' },
        }),
      ],
      events: [paymentEvent({ id: 1, type: 'CHARGEBACK_REVERSED', actor: 'PROVIDER' })],
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText(/카드사 이의 제기\(차지백\)/)).toHaveLength(2)
    await expect(canvas.getByText('환불 되돌려짐')).toBeVisible()
    await expect(canvas.getByText('분쟁에서 이겨 환불이 되돌려졌어요')).toBeVisible()
  },
}
