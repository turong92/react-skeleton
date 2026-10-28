import type { Meta, StoryObj } from '@storybook/react-vite'
import { ApiRequestError } from '@skeleton/api-client'
import { expect, fn, screen, waitFor, within } from 'storybook/test'
import { koPaymentLabels } from '../labels'
import { StopPriceDialog } from './StopPriceDialog'

/**
 * 가격의 판매를 멈추는 확인 창 - 어느 가격인지, 「기존 구독자는 이 가격 그대로」와 되돌릴 수 없다는 것을 먼저 말한다.
 * 처음 포커스는 「닫기」(실수로 Enter 를 눌러도 멈추지 않는다). 실패는 창 안에 이유를 띄운다.
 */
const onConfirm = fn()
const onClose = fn()
const meta = {
  title: 'Packages/payment/admin/StopPriceDialog',
  component: StopPriceDialog,
  args: {
    open: true,
    onClose,
    onConfirm,
    price: { code: 'standard-year', amount: 59000, currency: 'KRW' },
    locale: 'ko-KR',
    labels: koPaymentLabels,
  },
  beforeEach: () => {
    onConfirm.mockClear()
    onClose.mockClear()
  },
} satisfies Meta<typeof StopPriceDialog>
export default meta
type Story = StoryObj<typeof meta>

const dialogName = '이 가격의 판매를 중지할까요?'

export const ConfirmSendsOnce: Story = {
  play: async ({ userEvent }) => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: '닫기' })).toHaveFocus())
    await expect(dialog).toHaveTextContent('standard-year · 59,000원')
    await expect(dialog).toHaveTextContent('기존 구독자는 이 가격 그대로')
    await userEvent.click(within(dialog).getByRole('button', { name: '판매 중지' }))
    await expect(onConfirm).toHaveBeenCalledOnce()
  },
}

export const PriceNoLongerExists: Story = {
  args: {
    error: new ApiRequestError(
      { code: 'CATALOG.NOT_FOUND', title: 't', status: 404, timestamp: 't', traceId: 'tr' },
      'tr',
      'sp',
      'tp',
    ),
  },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await expect(dialog).toHaveTextContent('찾는 상품이나 가격이 없어요')
  },
}
