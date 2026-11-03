import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { fakeStatus } from './stories/fakeWaitingRoom'
import { koWaitingRoomLabels } from './labels'
import { WaitingScreen } from './WaitingScreen'

/**
 * 대기 화면 - 상태마다 하나. 오픈 전(카운트다운) · 기다리는 중(내 앞에 N명 · 예상 시간 · 진행 막대) · 입장이 멈춤 · 입장 시간 끝(다시 줄 서기) · 닫힘.
 * 문구는 `labels`. 페이지 앞 문(`WaitingRoomGate`)과 버튼 앞 문(`useWaitingRoom`)이 같은 화면을 쓴다.
 */
const meta = {
  title: 'Packages/waiting-room/WaitingScreen',
  component: WaitingScreen,
  parameters: { layout: 'padded' },
  args: { status: fakeStatus(), labels: koWaitingRoomLabels },
} satisfies Meta<typeof WaitingScreen>
export default meta
type Story = StoryObj<typeof meta>

export const Joining: Story = {
  args: { status: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('줄에 서는 중이에요…')
  },
}

export const BeforeOpening: Story = {
  args: {
    status: fakeStatus({
      state: 'PREQUEUE',
      position: null,
      ahead: null,
      estimatedWaitSeconds: null,
      opensAt: new Date(Date.now() + 3 * 3600_000 + 5_000).toISOString(),
    }),
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/^오픈까지 [23]:\d\d:\d\d$/)).toBeVisible()
    await expect(canvas.getByText(/오픈 순간에 순서가 무작위로/)).toBeVisible()
    await expect(canvas.getByText('새로고침해도 순서는 그대로예요.')).toBeVisible()
  },
}

export const WaitingInLine: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('내 앞에 10명')).toBeVisible()
    await expect(canvas.getByText('예상 대기 시간 약 5분')).toBeVisible()
    await expect(canvas.getByText('내 번호는 40번이에요')).toBeVisible()
    // 막대는 내 번호 40 중 30 까지 들어간 만큼
    const bar = canvas.getByRole('progressbar', { name: '줄 진행' })
    await expect(bar).toHaveValue(0.75)
    await expect(canvas.getByText('새로고침해도 순서는 그대로예요.')).toBeVisible()
  },
}

export const NextInLine: Story = {
  args: { status: fakeStatus({ position: 1, ahead: 0, estimatedWaitSeconds: 20 }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('내 앞에 0명')).toBeVisible()
    await expect(canvas.getByText('예상 대기 시간 1분 미만')).toBeVisible()
  },
}

export const EntryIsPaused: Story = {
  args: { status: fakeStatus({ estimatedWaitSeconds: null }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/지금은 입장이 잠시 멈췄어요/)).toBeVisible()
    await expect(canvas.queryByText(/예상 대기 시간/)).toBeNull()
  },
}

export const EntryTimeIsOver: Story = {
  args: { status: fakeStatus({ state: 'EXPIRED' }), onRejoin: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getByText('입장 시간이 끝났어요')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '다시 줄 서기' }))
    await expect(args.onRejoin).toHaveBeenCalledTimes(1)
  },
}

export const Closed: Story = {
  args: { status: fakeStatus({ state: 'CLOSED' }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('줄이 닫혔어요')).toBeVisible()
    await expect(canvas.queryByRole('button')).toBeNull()
  },
}

export const CouldNotCheck: Story = {
  args: { failed: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/순서를 확인하지 못했어요/)).toBeVisible()
    // 마지막으로 안 순서는 그대로 보인다
    await expect(canvas.getByText('내 앞에 10명')).toBeVisible()
  },
}
