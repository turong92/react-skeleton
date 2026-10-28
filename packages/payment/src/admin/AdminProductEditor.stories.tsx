import type { Meta, StoryObj } from '@storybook/react-vite'
import { ApiRequestError } from '@skeleton/api-client'
import { expect, fn } from 'storybook/test'
import { koPaymentLabels } from '../labels'
import { AdminProductEditor } from './AdminProductEditor'
import type { AdminCatalogProduct } from './catalogAdminTypes'

/**
 * 상품 폼(`@skeleton/payment/admin`) - 만들 때는 코드 · 종류(만든 뒤에는 못 바꾼다)까지, 고칠 때는 등급 · 인기 · 판매 중 · 정렬 · 언어별 이름과 설명.
 * 이름은 보이는 언어마다 필수, 등급은 구독 상품만. 틀린 칸은 「저장」을 누를 때 칸 아래에서 말하고 보내지 않는다. 코드 · 등급 중복은 서버의 거절을 말로 띄운다.
 */
const languages = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
]
const product: AdminCatalogProduct = {
  code: 'standard',
  kind: 'SUBSCRIPTION',
  level: 2,
  highlighted: false,
  selling: true,
  sortOrder: 2,
  texts: {
    ko: { name: '스탠다드', description: null },
    en: { name: 'Standard', description: null },
  },
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  prices: [],
}

const onSubmit = fn()
const meta = {
  title: 'Packages/payment/admin/AdminProductEditor',
  component: AdminProductEditor,
  args: { mode: 'create', languages, onSubmit, labels: koPaymentLabels },
  beforeEach: () => onSubmit.mockClear(),
} satisfies Meta<typeof AdminProductEditor>
export default meta
type Story = StoryObj<typeof meta>

export const CreateASubscriptionProduct: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('textbox', { name: /^상품 코드/ }), 'standard')
    await userEvent.type(canvas.getByRole('textbox', { name: /^등급/ }), '2')
    await userEvent.type(canvas.getByRole('textbox', { name: /^이름 \(한국어\)/ }), '스탠다드')
    await userEvent.type(canvas.getByRole('textbox', { name: /^이름 \(English\)/ }), 'Standard')
    const create = canvas.getByRole('button', { name: '상품 만들기' })
    await expect(create).toHaveAttribute('data-variant', 'primary')
    await userEvent.click(create)
    await expect(onSubmit).toHaveBeenCalledWith({
      code: 'standard',
      kind: 'SUBSCRIPTION',
      level: 2,
      highlighted: false,
      sortOrder: 0,
      texts: {
        ko: { name: '스탠다드', description: null },
        en: { name: 'Standard', description: null },
      },
    })
  },
}

export const MissingNamesAreNotSent: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('textbox', { name: /^상품 코드/ }), 'standard')
    await userEvent.click(canvas.getByRole('button', { name: '상품 만들기' }))
    await expect(canvas.getByText('한국어 이름을 적어 주세요')).toBeVisible()
    await expect(canvas.getByText('English 이름을 적어 주세요')).toBeVisible()
    await expect(onSubmit).not.toHaveBeenCalled()
  },
}

export const EditSwitchesSellingOff: Story = {
  args: { mode: 'edit', product },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.queryByRole('textbox', { name: /^상품 코드/ })).toBeNull()
    await expect(canvas.getByRole('textbox', { name: /^이름 \(한국어\)/ })).toHaveValue('스탠다드')
    await userEvent.click(canvas.getByRole('checkbox', { name: '판매 중' }))
    await userEvent.click(canvas.getByRole('button', { name: '저장' }))
    await expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ selling: false, level: 2, sortOrder: 2 }),
    )
  },
}

export const LevelAlreadyTaken: Story = {
  args: {
    mode: 'edit',
    product,
    error: new ApiRequestError(
      { code: 'CATALOG.LEVEL_TAKEN', title: 't', status: 409, timestamp: 't', traceId: 'tr' },
      'tr',
      'sp',
      'tp',
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('다른 구독 상품이 이미 쓰는 등급이에요.')).toBeVisible()
  },
}
