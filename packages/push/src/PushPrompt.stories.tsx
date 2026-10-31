import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, waitFor } from 'storybook/test'
import { koPushLabels } from './labels'
import { PushPrompt } from './PushPrompt'
import { WithQuery } from './stories/WithQuery'
import { fakePushApi, fakePushEnv, memoryStorage } from './test/fakePush'

/**
 * 앱 안 띠(soft ask) — 브라우저 권한 창을 바로 띄우지 않고 먼저 이유를 보여 준다.
 * 푸시를 쓸 수 있고 권한을 아직 안 물었고 쉬는 중이 아닐 때만 보인다. 「알림 받기」 클릭 안에서 권한을 묻고, 「나중에」는 14일 쉰다.
 * 띠를 언제 띄울지는 앱이 `open` 으로 정한다(예: 첫 노트를 저장한 뒤).
 */
function Demo({ snoozedUntil }: { snoozedUntil?: number }) {
  const [fake] = useState(() => ({
    env: fakePushEnv(),
    api: fakePushApi().api,
    storage: memoryStorage(
      snoozedUntil ? { 'skeleton.push.prompt-snoozed-until.acc_1': String(snoozedUntil) } : {},
    ),
  }))
  return (
    <WithQuery>
      <PushPrompt
        api={fake.api}
        accountId="acc_1"
        env={fake.env}
        storage={fake.storage}
        labels={koPushLabels}
      />
    </WithQuery>
  )
}

const meta = {
  title: 'Packages/push/PushPrompt',
  component: PushPrompt,
  args: { api: fakePushApi().api, accountId: 'acc_1' },
  render: () => <Demo />,
} satisfies Meta<typeof PushPrompt>
export default meta
type Story = StoryObj<typeof meta>

/** 보인다 — 「알림 받기」를 누르면 그 클릭 안에서 권한을 묻고 허용되면 띠가 사라진다 */
export const Visible: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('이 기기에서 알림 받기')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '알림 받기' }))
    await waitFor(() => expect(canvas.queryByText('이 기기에서 알림 받기')).toBeNull())
  },
}

/** 「나중에」를 누르면 쉰다 */
export const SnoozeWithLater: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '나중에' }))
    await waitFor(() => expect(canvas.queryByText('이 기기에서 알림 받기')).toBeNull())
  },
}

/** 쉬는 중이면 보이지 않는다 */
export const Resting: Story = {
  render: () => <Demo snoozedUntil={Date.now() + 86_400_000} />,
  play: async ({ canvas }) => {
    // 띠가 뜨는 데 걸리는 시간(설정을 읽고 브라우저를 재는 동안)을 지나도 없다
    await new Promise((resolve) => setTimeout(resolve, 200))
    await expect(canvas.queryByRole('button', { name: '알림 받기' })).toBeNull()
  },
}
