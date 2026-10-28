import type { Meta, StoryObj } from '@storybook/react-vite'
import { ApiRequestError } from '@skeleton/api-client'
import { expect, fn, screen, within } from 'storybook/test'
import { koPaymentLabels } from '../labels'
import { AddPriceDialog } from './AddPriceDialog'

/**
 * 가격 더하기 창 - 주기(구독 상품만) · 금액 · 통화 · 선택 가격 코드, 「행사가로 팔기」를 켜면 정가 · 시작 · 끝.
 * 금액은 통화의 기본 단위로 적고(`9900` · `9.99`) 창이 최소 단위 정수로 보낸다. 틀린 칸은 누를 때 칸 아래에서 말하고 보내지 않는다.
 */
const onSubmit = fn()
const onClose = fn()
const meta = {
  title: 'Packages/payment/admin/AddPriceDialog',
  component: AddPriceDialog,
  args: { open: true, onClose, onSubmit, kind: 'SUBSCRIPTION', labels: koPaymentLabels },
  beforeEach: () => {
    onSubmit.mockClear()
    onClose.mockClear()
  },
} satisfies Meta<typeof AddPriceDialog>
export default meta
type Story = StoryObj<typeof meta>

const dialogName = '가격 더하기'

export const MonthlyWonPrice: Story = {
  play: async ({ userEvent }) => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^금액/ }), '6900')
    await userEvent.click(within(dialog).getByRole('button', { name: '가격 더하기' }))
    await expect(onSubmit).toHaveBeenCalledWith({ period: 'P1M', amount: 6900, currency: 'KRW' })
  },
}

export const DollarsBecomeCents: Story = {
  play: async ({ userEvent }) => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await userEvent.selectOptions(within(dialog).getByLabelText('결제 주기'), 'P1Y')
    await userEvent.selectOptions(within(dialog).getByLabelText('통화'), 'USD')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^금액/ }), '19.99')
    await userEvent.click(within(dialog).getByRole('button', { name: '가격 더하기' }))
    await expect(onSubmit).toHaveBeenCalledWith({ period: 'P1Y', amount: 1999, currency: 'USD' })
  },
}

/** 행사가는 정가가 더 커야 한다 - 같거나 작으면 칸 아래에서 말하고 보내지 않는다 */
export const SaleNeedsAHigherRegularPrice: Story = {
  play: async ({ userEvent }) => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^금액/ }), '59000')
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /행사가로 팔기/ }))
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^정가/ }), '59000')
    await userEvent.click(within(dialog).getByRole('button', { name: '가격 더하기' }))
    await expect(within(dialog).getByText('정가는 행사가보다 커야 해요')).toBeVisible()
    await expect(onSubmit).not.toHaveBeenCalled()
    const regular = within(dialog).getByRole('textbox', { name: /^정가/ })
    await userEvent.clear(regular)
    await userEvent.type(regular, '69000')
    await userEvent.click(within(dialog).getByRole('button', { name: '가격 더하기' }))
    await expect(onSubmit).toHaveBeenCalledWith({
      period: 'P1M',
      amount: 59000,
      currency: 'KRW',
      compareAtAmount: 69000,
    })
  },
}

export const OneTimeHasNoPeriod: Story = {
  args: { kind: 'ONE_TIME' },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await expect(within(dialog).queryByLabelText('결제 주기')).toBeNull()
  },
}

export const OverlappingSalePeriod: Story = {
  args: {
    error: new ApiRequestError(
      { code: 'CATALOG.PRICE_OVERLAP', title: 't', status: 409, timestamp: 't', traceId: 'tr' },
      'tr',
      'sp',
      'tp',
    ),
  },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await expect(dialog).toHaveTextContent('판매 기간이 겹치는 가격')
  },
}
