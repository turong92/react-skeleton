import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, waitFor, within } from 'storybook/test'
import { ChangePlanDialog } from './ChangePlanDialog'
import { koPaymentLabels } from './labels'
import type { PlanChangePreview, SubscriptionPlan } from './subscriptionTypes'

/**
 * 플랜 올리기 확인 창 - 윗등급 플랜을 고르면 지금 결제될 금액과 다음 결제부터의 가격을 미리 보이고, 금액을 읽기 전에는 「플랜 바꾸기」가 잠긴다.
 * 확인은 창이 보인 그 금액(`expectedCharge`)을 보낸다. 거절이면 플랜은 그대로라고 말하고, 금액이 올랐으면 새 금액을 확인하라고 말한다.
 */
const plans: SubscriptionPlan[] = [
  {
    code: 'standard',
    name: 'Standard',
    amount: { amount: 6900, currency: 'KRW' },
    period: 'P1M',
    level: 2,
  },
  { code: 'pro', name: 'Pro', amount: { amount: 9900, currency: 'KRW' }, period: 'P1M', level: 3 },
]
const preview: PlanChangePreview = {
  planCode: 'standard',
  planName: 'Standard',
  charge: { amount: 1500, currency: 'KRW' },
  amount: { amount: 6900, currency: 'KRW' },
  period: 'P1M',
  restartsPeriod: false,
}
const onConfirm = fn()
const meta = {
  title: 'Packages/payment/ChangePlanDialog',
  component: ChangePlanDialog,
  args: {
    open: true,
    onClose: fn(),
    onConfirm,
    plans,
    planCode: 'standard',
    onPlanChange: fn(),
    preview,
    labels: koPaymentLabels,
    locale: 'ko-KR',
  },
  beforeEach: () => onConfirm.mockClear(),
} satisfies Meta<typeof ChangePlanDialog>
export default meta
type Story = StoryObj<typeof meta>

const dialogName = '더 높은 플랜으로 바꾸기'

export const ConfirmSendsTheShownCharge: Story = {
  play: async ({ userEvent }) => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await expect(dialog).toHaveTextContent('1,500원')
    await expect(dialog).toHaveTextContent('6,900원 · 1개월마다 결제')
    await userEvent.click(within(dialog).getByRole('button', { name: '플랜 바꾸기' }))
    await expect(onConfirm).toHaveBeenCalledWith({ planCode: 'standard', expectedCharge: 1500 })
  },
}

export const LockedUntilTheAmountIsRead: Story = {
  args: { preview: undefined, previewLoading: true },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await expect(dialog).toHaveTextContent('결제할 금액을 확인하는 중')
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: '플랜 바꾸기' })).toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    )
  },
}
