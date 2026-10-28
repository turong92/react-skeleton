import { ApiRequestError } from '@skeleton/api-client'
import { Button } from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import { expect, fn, waitFor } from 'storybook/test'
import { koPaymentLabels } from './labels'
import type { Order } from './ledgerTypes'
import { PaymentResult } from './PaymentResult'
import { order } from './test/fixtures'

/**
 * 결제 결과 — 됐어요 / 확인 중 / 늦어지고 있어요 / 안 됐어요 / 시간이 지났어요 / 그만뒀어요. 주문 상태가 그대로 단계가 된다.
 * 「확인 중」은 끝없이 돌지 않는다: `slowAfterMs` 뒤(기본 30초 — 스토리 · 시험은 짧게)에 「확인이 늦어지고 있어요」와 「결제 내역」 단추로 바뀐다.
 * 안 됐을 때의 문구는 거절의 종류(`data.category`)로 고르고, 결제사 코드는 참조 번호(`ErrorReference`) 안에만 있다. `testMode` 면 테스트 표시가 늘 붙는다.
 * 이름은 `orderName` 그대로(부품은 상품을 모른다).
 */
const declined = (category: string) =>
  new ApiRequestError(
    {
      code: 'PAYMENT.DECLINED',
      title: 'declined',
      status: 402,
      timestamp: '2026-01-01T00:00:00Z',
      traceId: 'trace-9',
      data: { providerCode: 'REJECT_CARD_COMPANY', category },
    },
    'trace-9',
    'span-1',
    'tp',
  )

const meta = {
  title: 'Packages/payment/PaymentResult',
  component: PaymentResult,
  args: {
    order: order({ orderName: '응원하기 3,000원' }),
    labels: koPaymentLabels,
    locale: 'ko-KR',
    formatTime: () => '2026. 1. 1. 오후 12:00',
    onViewHistory: fn(),
    onRetry: fn(),
  },
} satisfies Meta<typeof PaymentResult>
export default meta
type Story = StoryObj<typeof meta>

export const Paid: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('heading', { name: '결제됐어요' })).toBeVisible()
    await expect(canvas.getByText('응원하기 3,000원')).toBeVisible() // 이름과 금액은 따로 칸이다
    await expect(canvas.getByText('3,000원')).toBeVisible()
    await expect(canvas.getByText('현대카드 ····1234')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '결제 내역' }))
    await expect(args.onViewHistory).toHaveBeenCalled()
    await expect(canvas.queryByText(koPaymentLabels.testMode)).toBeNull()
  },
}

export const Refunded: Story = {
  args: { order: order({ status: 'REFUNDED', refundedAmount: 3000, refundableAmount: 0 }) },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('heading', { name: '환불됐어요' })).toBeVisible()
    await expect(canvas.queryByText('결제됐어요')).toBeNull()
    // 환불된 결제도 막다른 길이 아니다 — 결제 내역으로 돌아갈 단추가 있다
    await userEvent.click(canvas.getByRole('button', { name: '결제 내역' }))
    await expect(args.onViewHistory).toHaveBeenCalled()
  },
}

export const Confirming: Story = {
  args: { order: order({ status: 'CONFIRMING', paidAt: null }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: '결제 확인 중이에요' })).toBeVisible()
    await expect(canvas.getByText('결제를 확인하고 있어요')).toBeInTheDocument()
    await expect(canvas.queryByRole('button')).toBeNull()
  },
}

export const GetsSlowAfterAWhile: Story = {
  args: { order: order({ status: 'CONFIRMING', paidAt: null }), slowAfterMs: 80 },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('heading', { name: '결제 확인 중이에요' })).toBeVisible()
    await waitFor(() =>
      expect(canvas.getByRole('heading', { name: '확인이 늦어지고 있어요' })).toBeVisible(),
    )
    await expect(canvas.getByText('결제 내역에서 다시 볼 수 있어요.')).toBeVisible()
    await expect(canvas.queryByText('결제를 확인하고 있어요')).toBeNull() // 더는 돌지 않는다
    await userEvent.click(canvas.getByRole('button', { name: '결제 내역' }))
    await expect(args.onViewHistory).toHaveBeenCalled()
  },
}

/** 다른 결제로 바뀌면 「늦어지고 있어요」도 처음부터 — 이전 결제의 기다림을 물려받지 않는다 */
function SwitchOrder() {
  const [id, setId] = useState('ord_1')
  return (
    <>
      <Button variant="secondary" onClick={() => setId('ord_2')}>
        다른 결제 보기
      </Button>
      <PaymentResult
        order={order({ id, status: 'CONFIRMING', paidAt: null })}
        slowAfterMs={250}
        labels={koPaymentLabels}
        locale="ko-KR"
        onViewHistory={() => undefined}
      />
    </>
  )
}

export const SlownessStartsOverForAnotherOrder: Story = {
  render: () => <SwitchOrder />,
  play: async ({ canvas, userEvent }) => {
    await waitFor(() =>
      expect(canvas.getByRole('heading', { name: '확인이 늦어지고 있어요' })).toBeVisible(),
    )
    await userEvent.click(canvas.getByRole('button', { name: '다른 결제 보기' }))
    await expect(canvas.getByRole('heading', { name: '결제 확인 중이에요' })).toBeVisible()
    await waitFor(() =>
      expect(canvas.getByRole('heading', { name: '확인이 늦어지고 있어요' })).toBeVisible(),
    )
  },
}

export const Slow: Story = {
  args: { order: order({ status: 'CONFIRMING', paidAt: null }), slowAfterMs: 0 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: '확인이 늦어지고 있어요' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: '결제 내역' })).toBeVisible()
  },
}

function ConfirmingThenPaid(props: { order: Order }) {
  const [current, setCurrent] = useState<Order>({
    ...props.order,
    status: 'CONFIRMING',
    paidAt: null,
  })
  useEffect(() => {
    const timer = setTimeout(() => setCurrent(props.order), 80)
    return () => clearTimeout(timer)
  }, [props.order])
  return (
    <PaymentResult
      order={current}
      labels={koPaymentLabels}
      locale="ko-KR"
      formatTime={() => '2026. 1. 1. 오후 12:00'}
      onViewHistory={() => undefined}
    />
  )
}

export const ConfirmingBecomesPaid: Story = {
  render: (args) => <ConfirmingThenPaid order={args.order as Order} />,
  play: async ({ canvas }) => {
    const heading = await canvas.findByRole('heading', { name: '결제됐어요' })
    // 결과가 바뀌면 제목으로 포커스가 옮겨 가서 낭독된다
    await waitFor(() => expect(heading).toHaveFocus())
  },
}

export const FailedLimitOrBalance: Story = {
  args: { order: order({ status: 'FAILED', paidAt: null }), error: declined('LIMIT_OR_BALANCE') },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('heading', { name: '결제가 안 됐어요' })).toBeVisible()
    await expect(canvas.getByText(koPaymentLabels.failure.LIMIT_OR_BALANCE)).toBeVisible()
    // 결제사 코드는 참조 번호 안에만 — 문장에는 없다
    await expect(canvas.getByText(/REJECT_CARD_COMPANY/).tagName).toBe('CODE')
    await expect(canvas.getAllByText(/REJECT_CARD_COMPANY/)).toHaveLength(1)
    await userEvent.click(canvas.getByRole('button', { name: '다시 해 보기' }))
    await expect(args.onRetry).toHaveBeenCalled()
    // 주 단추는 하나 — 「결제 내역」은 테두리 단추
    await expect(canvas.getByRole('button', { name: '결제 내역' })).toHaveAttribute(
      'data-variant',
      'secondary',
    )
  },
}

export const FailedCardDeclined: Story = {
  args: { order: order({ status: 'FAILED', paidAt: null }), error: declined('CARD_DECLINED') },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(koPaymentLabels.failure.CARD_DECLINED)).toBeVisible()
  },
}

export const FailedTemporary: Story = {
  args: { order: order({ status: 'FAILED', paidAt: null }), error: declined('TEMPORARY') },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(koPaymentLabels.failure.TEMPORARY)).toBeVisible()
  },
}

export const FailedUnknownCategoryUsesTheOtherSentence: Story = {
  args: { order: order({ status: 'FAILED', paidAt: null }), error: declined('SOMETHING_NEW') },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(koPaymentLabels.failure.OTHER)).toBeVisible()
  },
}

const conflict = (code: string, status: number) =>
  new ApiRequestError(
    { code, title: 't', status, timestamp: '2026-01-01T00:00:00Z', traceId: 'trace-3' },
    'trace-3',
    'span-3',
    'tp',
  )

const lost = new ApiRequestError(
  {
    code: 'CLIENT.NETWORK_ERROR',
    title: 'Network error',
    status: 0,
    timestamp: '2026-01-01T00:00:00Z',
  },
  'trace-1',
  'span-1',
  'tp',
)

/** 승인 호출이 시간 초과/네트워크 오류로 끝났다(훅이 다시 보내 본 뒤) = 결과를 모른다. 「결제 안 됨」도 「다시 해 보기」도 아니다 — 기다리게 하지 않고 결제 내역으로 보낸다 */
export const ConfirmCallLostIsNotAFailure: Story = {
  args: { order: undefined, error: lost },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: '확인이 늦어지고 있어요' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '다시 해 보기' })).toBeNull()
    await expect(canvas.queryByText('결제가 안 됐어요')).toBeNull()
    await expect(canvas.getByRole('button', { name: '결제 내역' })).toBeVisible()
  },
}

/** 서버가 이 승인 요청을 받지 않았다(409 …) 그리고 주문은 아직 끝나지 않았다: 돌지도 않고 다시 결제하라고도 하지 않는다 */
export const NotConfirmedAfterAConflict: Story = {
  args: {
    order: order({ status: 'PENDING', paidAt: null }),
    error: conflict('PAYMENT.ORDER_NOT_PAYABLE', 409),
  },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('heading', { name: '결제를 확인하지 못했어요' })).toBeVisible()
    await expect(canvas.queryByText('결제를 확인하고 있어요')).toBeNull() // 스피너 없음
    await expect(canvas.queryByRole('button', { name: '다시 해 보기' })).toBeNull()
    await expect(canvas.getByText('trace-3')).toBeVisible() // 참조 번호
    await userEvent.click(canvas.getByRole('button', { name: '결제 내역' }))
    await expect(args.onViewHistory).toHaveBeenCalled()
  },
}

export const NotConfirmedBeforeTheOrderIsRead: Story = {
  args: { order: undefined, error: conflict('PAYMENT.AMOUNT_MISMATCH', 400) },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: '결제를 확인하지 못했어요' })).toBeVisible()
  },
}

/** 서버가 다시 읽어 준 주문이 끝 상태면 그 상태가 오류를 이긴다 */
export const TheOrderTheServerHoldsBeatsTheError: Story = {
  args: {
    order: order({ status: 'FAILED', paidAt: null }),
    error: conflict('PAYMENT.ORDER_NOT_PAYABLE', 409),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: '결제가 안 됐어요' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: '다시 해 보기' })).toBeVisible()
    await expect(canvas.queryByText('결제를 확인하지 못했어요')).toBeNull()
  },
}

/** 서버가 답한 확정 거절(402)은 주문을 다시 불러오기 전에도 「결제 안 됨」 */
export const DeclinedBeforeTheOrderIsRefetched: Story = {
  args: { order: undefined, error: declined('CARD_DECLINED') },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: '결제가 안 됐어요' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: '다시 해 보기' })).toBeVisible()
  },
}

export const Stopped: Story = {
  args: { order: order({ status: 'CANCELED', paidAt: null }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: '결제를 그만뒀어요' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: '다시 해 보기' })).toBeVisible()
  },
}

export const TimedOut: Story = {
  args: { order: order({ status: 'EXPIRED', paidAt: null }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: '결제 시간이 지났어요' })).toBeVisible()
  },
}

export const TestPayment: Story = {
  args: { order: order({ testMode: true }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('테스트 결제예요. 실제로 돈이 나가지 않아요')).toBeVisible()
  },
}

export const English: Story = {
  args: { labels: undefined, locale: 'en-US' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Payment done' })).toBeVisible()
  },
}

export const EnglishNotConfirmed: Story = {
  args: {
    labels: undefined,
    locale: 'en-US',
    order: undefined,
    error: conflict('PAYMENT.ORDER_NOT_PAYABLE', 409),
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('heading', { name: 'We could not confirm the payment' }),
    ).toBeVisible()
    await expect(canvas.getByText('Reference')).toBeVisible()
    await expect(canvas.queryByText('Loading')).toBeNull()
  },
}

/** 320px · 375px — 참조 번호가 붙는 단계(안 됐어요 · 확인하지 못했어요)도 가로 스크롤이 없다. 끊을 곳 없는 긴 이름 · 긴 참조 번호도 */
function Narrow({ width, english }: { width: string; english?: boolean }) {
  const long = 'Supercalifragilisticexpialidocious'.repeat(3)
  return (
    <div data-testid="frame" style={{ width }}>
      <PaymentResult
        order={order({ orderName: long, status: 'PENDING', paidAt: null, testMode: true })}
        error={
          new ApiRequestError(
            {
              code: 'PAYMENT.ORDER_NOT_PAYABLE',
              title: 't',
              status: 409,
              timestamp: 't',
              traceId: long,
            },
            long,
            'sp',
            'tp',
          )
        }
        onViewHistory={() => undefined}
        {...(english ? { locale: 'en-US' } : { labels: koPaymentLabels, locale: 'ko-KR' })}
      />
    </div>
  )
}

export const NotConfirmedAt320: Story = {
  render: () => <Narrow width="20rem" />,
  play: async ({ canvas }) => {
    const frame = canvas.getByTestId('frame')
    await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth)
  },
}

export const NotConfirmedAt375: Story = {
  render: () => <Narrow width="23.4375rem" />,
  play: async ({ canvas }) => {
    const frame = canvas.getByTestId('frame')
    await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth)
  },
}

export const NotConfirmedInEnglishAt320: Story = {
  render: () => <Narrow width="20rem" english />,
  play: async ({ canvas }) => {
    const frame = canvas.getByTestId('frame')
    await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth)
  },
}

/** 쿠폰으로 0원 — 결제창 없이 끝났다: 설명이 이유를 말하고 결제 수단 자리에 「무료(쿠폰)」 */
export const FreeByCoupon: Story = {
  args: {
    order: order({
      orderName: '응원하기 3,000원',
      amount: { amount: 0, currency: 'KRW' },
      originalAmount: 3000,
      discountAmount: 3000,
      discounts: [{ type: 'coupon', ref: 'c2', label: '무료 이용권', amount: 3000 }],
      settlement: 'FREE',
      refundableAmount: 0,
      method: null,
      card: null,
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: '결제됐어요' })).toBeVisible()
    await expect(canvas.getByText('쿠폰으로 0원이라 결제 없이 끝났어요.')).toBeVisible()
    await expect(canvas.getByText('무료(쿠폰)')).toBeVisible()
  },
}
