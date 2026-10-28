import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, waitFor, within } from 'storybook/test'
import { ChangePlanDialog } from './ChangePlanDialog'
import { koPaymentLabels } from './labels'
import type { PlanChangePreview, SubscriptionPlan } from './subscriptionTypes'

/**
 * 플랜 바꾸기 확인 창 - 플랜을 고르면 지금 결제될 금액과 다음 결제부터의 가격을 미리 보이고, 금액을 읽기 전에는 「이 플랜으로 바꾸기」가 잠긴다.
 * 내리기 · 주기 줄이기는 예약이다 - 선택지는 「바로 바꿔요」/「다음 결제일부터 바꿔요」로 묶이고, 예약이면 결제 금액 대신 바뀌는 날을 보이며 확인은 「변경 예약」이 된다.
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

const dialogName = '플랜을 바꿀까요?'

export const ConfirmSendsTheShownCharge: Story = {
  play: async ({ userEvent }) => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await expect(dialog).toHaveTextContent('1,500원')
    await expect(dialog).toHaveTextContent('6,900원 · 1개월마다 결제')
    await userEvent.click(within(dialog).getByRole('button', { name: '이 플랜으로 바꾸기' }))
    await expect(onConfirm).toHaveBeenCalledWith({ planCode: 'standard', expectedCharge: 1500 })
  },
}

export const LockedUntilTheAmountIsRead: Story = {
  args: { preview: undefined, previewLoading: true },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await expect(dialog).toHaveTextContent('결제할 금액을 확인하는 중')
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: '이 플랜으로 바꾸기' })).toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    )
  },
}

/** 내리기는 예약 - 결제 금액 대신 바뀌는 날, 확인은 「변경 예약」, 보내는 `expectedCharge` 는 0 */
export const ScheduledDowngrade: Story = {
  args: {
    plans: [
      {
        code: 'basic',
        name: 'Basic',
        amount: { amount: 3900, currency: 'KRW' },
        period: 'P1M',
        level: 1,
      },
      ...plans,
    ],
    current: { level: 2, period: 'P1M', currency: 'KRW' },
    planCode: 'basic',
    preview: {
      planCode: 'basic',
      planName: 'Basic',
      charge: { amount: 0, currency: 'KRW' },
      amount: { amount: 3900, currency: 'KRW' },
      period: 'P1M',
      restartsPeriod: false,
      timing: 'NEXT_RENEWAL',
      effectiveAt: '2026-11-01T03:00:00Z',
    },
  },
  play: async ({ userEvent }) => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    const select = within(dialog).getByRole('combobox')
    await expect(within(select).getByRole('group', { name: '바로 바꿔요' })).toBeVisible()
    await expect(
      within(select).getByRole('group', { name: '다음 결제일부터 바꿔요' }),
    ).toBeVisible()
    await expect(dialog).toHaveTextContent('바뀌는 날')
    await expect(dialog).not.toHaveTextContent('지금 결제할 금액')
    await expect(dialog).toHaveTextContent('지금 결제되는 금액은 없어요')
    const confirm = within(dialog).getByRole('button', { name: '변경 예약' })
    await expect(confirm).toHaveAttribute('data-variant', 'primary')
    await userEvent.click(confirm)
    await expect(onConfirm).toHaveBeenCalledWith({ planCode: 'basic', expectedCharge: 0 })
  },
}

/** 주기를 늘리면 서버가 남은 몫(`credit`)을 깎아 준다 - 공제액과 결제할 금액을 같이 말한다. 공제가 없으면 「전액을 결제하고」 */
export const LongerPeriodWithCredit: Story = {
  args: {
    plans: [
      {
        code: 'standard-yearly',
        name: 'Standard',
        amount: { amount: 69000, currency: 'KRW' },
        period: 'P1Y',
        level: 2,
      },
    ],
    current: { level: 2, period: 'P1M', currency: 'KRW' },
    planCode: 'standard-yearly',
    preview: {
      planCode: 'standard-yearly',
      planName: 'Standard',
      charge: { amount: 62100, currency: 'KRW' },
      credit: { amount: 6900, currency: 'KRW' },
      amount: { amount: 69000, currency: 'KRW' },
      period: 'P1Y',
      restartsPeriod: true,
    },
  },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await expect(dialog).toHaveTextContent('남은 이용분 6,900원을 빼고 62,100원 결제돼요')
    await expect(dialog).toHaveTextContent('69,000원 · 1년마다 결제')
  },
}
