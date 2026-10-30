import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { koRewardsLabels } from '../labels'
import { createFakeRewards } from '../stories/fakeRewards'
import { WithQuery } from '../stories/WithQuery'
import { ReferralCodeForm } from './ReferralCodeForm'

/**
 * 초대 코드 직접 입력(`POST /referrals/claim`) — 링크 없이 가입한 사람이 가입 뒤에 코드를 넣는다.
 * `GET /referrals/me` 의 `canClaim` 일 때만 그린다(이미 초대받았거나 기간이 지나면 아무것도 안 그림).
 * 거절 이유(`data.reason`)마다 문구가 다르다 — 내 코드 · 없는 코드 · 이미 초대받음 · 서로 초대 · 새 계정 아님 · 이벤트 끝남.
 * 가짜 API: 코드 `OWN` · `NOPE` · `DUP` · `MUTUAL` · `OLD` · `ENDED` 는 거절, 그 밖은 성공.
 */
const meta = {
  title: 'Packages/rewards/ReferralCodeForm',
  component: ReferralCodeForm,
  parameters: { layout: 'centered' },
  args: {
    api: createFakeRewards({ canClaim: true }).api,
    labels: koRewardsLabels,
    locale: 'ko-KR',
  },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof ReferralCodeForm>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => <ReferralCodeForm {...args} api={createFakeRewards({ canClaim: true }).api} />,
  play: async ({ canvas, userEvent }) => {
    const input = await canvas.findByLabelText('친구 초대 코드')
    await expect(canvas.getByText(/까지 입력할 수 있어요/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: '코드 입력' })).toBeDisabled()
    await userEvent.type(input, 'FRIEND01')
    await userEvent.click(canvas.getByRole('button', { name: '코드 입력' }))
    await expect(await canvas.findByText('초대 코드를 적용했어요.')).toBeVisible()
  },
}

export const NotClaimable: Story = {
  render: (args) => (
    <div data-testid="host">
      <ReferralCodeForm {...args} api={createFakeRewards({ canClaim: false }).api} />
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    // 입력할 수 없는 계정에는 아무것도 그리지 않는다 - 응답을 기다린 뒤에도 비어 있다
    await new Promise((resolve) => setTimeout(resolve, 100))
    await expect(canvas.queryByLabelText('친구 초대 코드')).toBeNull()
    await expect(canvasElement.querySelector('[data-testid="host"]')?.textContent).toBe('')
  },
}

export const Rejected: Story = {
  render: (args) => <ReferralCodeForm {...args} api={createFakeRewards({ canClaim: true }).api} />,
  play: async ({ canvas, userEvent }) => {
    const input = await canvas.findByLabelText('친구 초대 코드')
    const cases: [string, string][] = [
      ['NOPE', '없는 초대 코드예요. 다시 확인해 주세요.'],
      ['OWN', '내 초대 코드는 쓸 수 없어요.'],
      ['DUP', '이미 초대를 받았어요.'],
      ['MUTUAL', '나를 초대한 친구의 코드는 쓸 수 없어요.'],
      ['OLD', '새로 가입한 계정만 쓸 수 있어요.'],
      ['ENDED', '지금은 초대 이벤트가 열려 있지 않아요.'],
    ]
    for (const [code, message] of cases) {
      await userEvent.clear(input)
      await userEvent.type(input, code)
      await userEvent.click(canvas.getByRole('button', { name: '코드 입력' }))
      await expect(await canvas.findByText(message)).toBeVisible()
    }
  },
}
