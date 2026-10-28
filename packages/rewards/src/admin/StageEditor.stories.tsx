import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect } from 'storybook/test'
import type { CouponStage } from '../types'
import { koRewardsAdminLabels } from './labels'
import { StageEditor } from './StageEditor'

/**
 * 쿠폰 혜택 단계 편집기 — 단계(무료 · 정률 · 정액) × 횟수(또는 영원히). 단계는 다섯까지(여섯째 단추는 꺼지고 이유가 옆에),
 * 「영원히」는 마지막 단계만. 「무료 이용권」 · 「n달 무료」 틀 단추가 단계를 통째로 채운다.
 */
function Demo({ initial = [] }: { initial?: CouponStage[] }) {
  const [stages, setStages] = useState<CouponStage[]>(initial)
  return <StageEditor stages={stages} onChange={setStages} labels={koRewardsAdminLabels} />
}

const meta = {
  title: 'Packages/rewards/admin/StageEditor',
  component: StageEditor,
  parameters: { layout: 'padded' },
  args: { stages: [], onChange: () => {} },
} satisfies Meta<typeof StageEditor>
export default meta
type Story = StoryObj<typeof meta>

export const Templates: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '무료 이용권' }))
    await expect(canvas.getByLabelText('1단계 종류')).toHaveValue('FREE')
    await expect(canvas.getByLabelText('1단계 횟수')).toHaveValue(1)
    await userEvent.click(canvas.getByRole('button', { name: '3달 무료' }))
    await expect(canvas.getByLabelText('1단계 횟수')).toHaveValue(3)
    await expect(canvas.queryByLabelText('1단계 값')).toBeNull()
  },
}

export const AddStagesUpToFive: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    const add = canvas.getByRole('button', { name: '단계 더하기' })
    for (let i = 0; i < 5; i++) await userEvent.click(add)
    await expect(canvas.getByLabelText('5단계 종류')).toBeVisible()
    await expect(add).toBeDisabled()
    await expect(canvas.getByText('단계는 5개까지예요.')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '5단계 빼기' }))
    await expect(add).toBeEnabled()
  },
}

export const ForeverOnlyOnTheLastStep: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    const add = canvas.getByRole('button', { name: '단계 더하기' })
    await userEvent.click(add)
    await userEvent.click(add)
    await expect(canvas.getByLabelText('1단계 영원히')).toBeDisabled()
    const last = canvas.getByLabelText('2단계 영원히')
    await userEvent.click(last)
    await expect(last).toBeChecked()
    await expect(canvas.getByLabelText('2단계 횟수')).toBeDisabled()
    // 영원한 끝 뒤에 단계를 더하면 앞 단계가 유한해진다
    await userEvent.click(add)
    await expect(canvas.getByLabelText('2단계 영원히')).not.toBeChecked()
    await expect(canvas.getByLabelText('2단계 횟수')).toHaveValue(1)
  },
}
