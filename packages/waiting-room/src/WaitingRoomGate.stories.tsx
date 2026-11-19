import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { ButtonGateDemo, PageGateDemo } from './stories/Demos'
import { fakeStatus } from './stories/fakeWaitingRoom'

/**
 * 대기실 문 - 두 모양. **페이지 앞**(`WaitingRoomGate`): 순번이 오기 전엔 대기 화면, 입장하면 children 이 그려지고 `useWaitingRoomEntry()` 로 입장권을 읽는다.
 * **버튼 앞**(`useWaitingRoom(id).enter()`): 누르면 줄을 서고 입장권이 오면 돌려준다 - 대기 화면은 앱이 `WaitingScreen` 으로 놓는다.
 * 입장권은 자리를 더하는 요청마다 `createEntryHeaders(entryToken)` 로 보낸다. 서버가 정한 간격(스토리에서는 1초)으로 묻는다.
 */
const meta = {
  title: 'Packages/waiting-room/WaitingRoomGate',
  component: PageGateDemo,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PageGateDemo>
export default meta
type Story = StoryObj<typeof meta>

export const PageGateWaitsThenLetsIn: Story = {
  args: {
    script: [
      fakeStatus({ ahead: 2, position: 5 }),
      fakeStatus({ state: 'ADMITTED', entryToken: 'entry-1' }),
    ],
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('내 앞에 2명')).toBeVisible()
    await expect(canvas.queryByText(/입장한 화면/)).toBeNull()
    await expect(
      await canvas.findByText('입장한 화면 (입장권: entry-1)', {}, { timeout: 4000 }),
    ).toBeVisible()
    await expect(canvas.queryByText('내 앞에 2명')).toBeNull()
  },
}

export const PageGateKeepsTheWorkWhenTheEntryTimeEnds: Story = {
  args: {
    script: [
      fakeStatus({ state: 'ADMITTED', entryToken: 'entry-1' }),
      fakeStatus({ state: 'EXPIRED' }),
    ],
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('입장한 화면 (입장권: entry-1)')).toBeVisible()
    // 하던 일은 그대로 두고 입장권만 거둔다
    await expect(
      await canvas.findByText('입장한 화면 (입장권: 없음)', {}, { timeout: 4000 }),
    ).toBeVisible()
    await expect(canvas.getByText(/입장 시간이 끝나 새로 시작할 수는 없어요/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: '다시 줄 서기' })).toBeVisible()
  },
}

export const ButtonGateReturnsTheEntryToken: Story = {
  render: (args) => <ButtonGateDemo {...args} />,
  args: {
    script: [
      fakeStatus({ ahead: 3, position: 6 }),
      fakeStatus({ state: 'ADMITTED', entryToken: 'entry-9' }),
    ],
  },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.queryByText(/내 앞에/)).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: '예약하기' }))
    await expect(await canvas.findByText('내 앞에 3명')).toBeVisible()
    await expect(canvas.getByRole('status', { name: 'log' })).toHaveTextContent('')
    await expect(await canvas.findByText('entered:entry-9', {}, { timeout: 4000 })).toBeVisible()
  },
}

export const ButtonGateRefusesWhenTheRoomIsClosed: Story = {
  render: (args) => <ButtonGateDemo {...args} />,
  args: { script: [fakeStatus({ state: 'CLOSED' })] },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '예약하기' }))
    await expect(await canvas.findByText('failed:closed')).toBeVisible()
    await expect(canvas.getByText('줄이 닫혔어요')).toBeVisible()
  },
}
