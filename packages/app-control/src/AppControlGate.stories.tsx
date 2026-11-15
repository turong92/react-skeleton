import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo } from 'react'
import { expect, waitFor } from 'storybook/test'
import { AppControlGate } from './AppControlGate'
import { koAppControlLabels } from './labels'
import { createFakeAppControlApi } from './stories/fakeAppControlApi'
import { WithQuery } from './stories/WithQuery'
import type { AppConfig } from './types'

/**
 * 앱 맨 위의 문 — 서버가 점검 중이라고 하면 점검 화면, 최소 버전 미만이면 닫을 수 없는 새로고침 화면, 권장 버전 미만이면 닫을 수 있는 띠.
 * 설정을 못 읽으면 막지 않는다. 운영자 화면은 `bypass` 로 문 밖에 둔다(점검을 끄는 곳이 점검 화면에 가려지면 안 된다).
 */
function Demo({
  config,
  appVersion,
  bypass,
}: {
  config?: Partial<AppConfig>
  appVersion?: string
  bypass?: boolean
}) {
  const api = useMemo(() => createFakeAppControlApi(config), [config])
  return (
    <WithQuery>
      <AppControlGate
        api={api}
        appVersion={appVersion}
        bypass={bypass}
        labels={koAppControlLabels}
        onUpdate={() => undefined}
      >
        <main>
          <h1>내 노트</h1>
        </main>
      </AppControlGate>
    </WithQuery>
  )
}

const meta = {
  title: 'Packages/app-control/AppControlGate',
  component: Demo,
} satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof meta>

const web = (minVersion: string | null, recommendedVersion: string | null) => ({
  platforms: { web: { minVersion, recommendedVersion, storeUrl: null } },
})

export const NothingSetShowsTheApp: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: '내 노트' })).toBeVisible()
    await expect(canvas.queryByRole('alert')).toBeNull()
  },
}

export const Maintenance: Story = {
  args: {
    config: {
      maintenance: {
        enabled: true,
        message: 'DB 이전 작업 중이에요',
        endsAt: '2099-01-01T10:00:00Z',
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('지금은 점검 중이에요')).toBeVisible()
    await expect(canvas.getByText('DB 이전 작업 중이에요')).toBeVisible()
    await expect(canvas.getByText(/다시 열릴 예정이에요/)).toBeVisible()
    await expect(canvas.queryByRole('heading', { name: '내 노트' })).toBeNull()
  },
}

/** 최소 버전 미만 — 닫을 수 없다. 1.9 는 1.10 보다 낮다(숫자 칸 비교) */
export const UpdateRequired: Story = {
  args: { config: web('1.10', null), appVersion: '1.9' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('업데이트가 필요해요')).toBeVisible()
    await expect(canvas.getByRole('button', { name: '새로고침' })).toBeVisible()
    await expect(canvas.queryByRole('heading', { name: '내 노트' })).toBeNull()
  },
}

/** 같은 앱 버전이 최소와 같으면 막히지 않는다(1.10 은 1.9 보다 낮지 않다) */
export const NewerThanTheMinimumPasses: Story = {
  args: { config: web('1.9', null), appVersion: '1.10' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: '내 노트' })).toBeVisible()
  },
}

export const UpdateRecommendedCanBeClosed: Story = {
  args: { config: web('1.0', '1.10'), appVersion: '1.9' },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('새 버전이 나왔어요')).toBeVisible()
    await expect(canvas.getByRole('heading', { name: '내 노트' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '나중에' }))
    await waitFor(() => expect(canvas.queryByText('새 버전이 나왔어요')).toBeNull())
    await expect(canvas.getByRole('heading', { name: '내 노트' })).toBeVisible()
  },
}

/** 운영자 화면 — 점검 중에도 문 밖이라 가려지지 않는다 */
export const BypassKeepsTheOperatorScreenOpen: Story = {
  args: { config: { maintenance: { enabled: true, message: null, endsAt: null } }, bypass: true },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: '내 노트' })).toBeVisible()
    await expect(canvas.queryByText('지금은 점검 중이에요')).toBeNull()
  },
}
