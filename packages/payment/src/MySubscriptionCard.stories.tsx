import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { koPaymentLabels } from './labels'
import { MySubscriptionCard } from './MySubscriptionCard'
import { order, subscription } from './test/fixtures'

/**
 * 「내 구독」 카드 — 플랜 · 상태 알약(글자) · 금액 · 다음 결제일 · 카드 끝 네 자리 · 최근 결제 · 채운 「해지 예약」 단추 하나.
 * 상태마다 말이 다르다: 이용 중(`ACTIVE`) / 해지 예약됨(`CANCELING`, 다음 결제일 대신 「○○에 끝나요」) / 결제 다시 시도 중(`PAST_DUE`, 이용 불가) /
 * 결제 확인 중(`PENDING`) / 끝남(`ENDED`, 끝난 이유를 글자로). 해지 확인 창은 `CancelSubscriptionDialog` — 단추를 누르면 부모가 연다.
 */
const meta = {
  title: 'Packages/payment/MySubscriptionCard',
  component: MySubscriptionCard,
  args: {
    subscription: subscription(),
    orders: [
      order({
        id: 'ord_9',
        orderName: 'Standard 6,900',
        amount: { amount: 6900, currency: 'KRW' },
      }),
    ],
    onCancel: fn(),
    renderOrderAction: (_order, label, accessibleName, className) => (
      <a href="#order" className={className} aria-label={accessibleName}>
        {label}
      </a>
    ),
    labels: koPaymentLabels,
    locale: 'ko-KR',
    formatTime: () => '2026. 11. 1. 오후 12:00',
  },
} satisfies Meta<typeof MySubscriptionCard>
export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByText('구독 중')).toBeVisible()
    await expect(canvas.getByText('다음 결제일')).toBeVisible()
    // 카드는 칸에도, 최근 결제 줄에도 있다
    await expect(canvas.getAllByText('현대카드 ····1234')).toHaveLength(2)
    const cancel = canvas.getByRole('button', { name: '기간 끝에 해지' })
    await expect(cancel).toHaveAttribute('data-variant', 'primary')
    await userEvent.click(cancel)
    await expect(args.onCancel).toHaveBeenCalledOnce()
    // 최근 결제 줄 끝은 눌리는 모양의 링크다
    await expect(canvas.getByRole('link', { name: '자세히: Standard 6,900' })).toBeVisible()
  },
}

/** 결제사가 직접 받은 간편결제(카카오페이 · 네이버페이)는 카드 끝 네 자리 대신 앱 이름이 보인다 */
export const PaidWithKakaoPay: Story = {
  args: {
    subscription: subscription({
      easyPayBrand: 'KAKAOPAY',
      card: { issuer: 'HYUNDAI', last4: null },
    }),
    orders: [],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('카카오페이 · 현대카드')).toBeVisible()
    await expect(canvas.queryByText('KAKAOPAY')).toBeNull()
  },
}

export const CancelNowOffered: Story = {
  args: { onCancelNow: fn() },
  play: async ({ canvas, args, userEvent }) => {
    // 두 해지 단추는 같은 무게 - 둘 다 테두리
    await expect(canvas.getByRole('button', { name: '기간 끝에 해지' })).toHaveAttribute(
      'data-variant',
      'secondary',
    )
    const now = canvas.getByRole('button', { name: '지금 해지하고 환불' })
    await expect(now).toHaveAttribute('data-variant', 'secondary')
    await userEvent.click(now)
    await expect(args.onCancelNow).toHaveBeenCalledOnce()
  },
}

export const Canceling: Story = {
  args: { subscription: subscription({ status: 'CANCELING' }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('해지 예약됨')).toBeVisible()
    await expect(canvas.getByText('2026. 11. 1. 오후 12:00에 끝나요')).toBeVisible()
    await expect(canvas.queryByText('다음 결제일')).toBeNull()
    await expect(canvas.queryByRole('button', { name: '기간 끝에 해지' })).toBeNull()
  },
}

export const PastDue: Story = {
  args: { subscription: subscription({ status: 'PAST_DUE', attempt: 2 }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('결제 다시 시도 중')).toBeVisible()
    await expect(canvas.getByText(/그동안은 이용할 수 없어요/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: '기간 끝에 해지' })).toBeVisible()
  },
}

export const Ended: Story = {
  args: {
    subscription: subscription({ status: 'ENDED', endReason: 'PAYMENT_FAILED', card: null }),
    orders: [],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('끝남')).toBeVisible()
    await expect(canvas.getByText(/카드를 확인하고 다시 구독해 주세요/)).toBeVisible()
    await expect(canvas.queryByRole('button')).toBeNull()
  },
}
