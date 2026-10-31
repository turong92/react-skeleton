import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, waitFor } from 'storybook/test'
import { koPushLabels } from './labels'
import { PushSettings } from './PushSettings'
import { WithQuery } from './stories/WithQuery'
import { fakePushApi, fakePushEnv, KEY_A, memoryStorage } from './test/fakePush'
import type { PushDevice, PushPreference } from './types'

const THIS_DEVICE = 'inst_this_device_000'

const device = (
  id: string,
  label: string | null,
  kind: PushDevice['kind'] = 'WEBPUSH',
): PushDevice => ({
  installationId: id,
  kind,
  platform: kind === 'FCM' ? 'android' : null,
  label,
  createdAt: '2026-01-01T00:00:00Z',
  lastSeenAt: '2026-01-03T09:30:00Z',
})

const types: PushPreference[] = [
  { type: 'NOTE_UPDATED', push: true, allChannelsMuted: false },
  { type: 'comment.created', push: false, allChannelsMuted: false },
]

type DemoProps = {
  env?: Parameters<typeof fakePushEnv>[0]
  enabled?: boolean
  devices?: PushDevice[]
  preferences?: PushPreference[]
  webPush?: boolean
}

function Demo({ env: envInit, enabled, devices, preferences, webPush = true }: DemoProps) {
  const [fake] = useState(() => ({
    env: fakePushEnv(envInit),
    storage: memoryStorage({
      'skeleton.push.installation-id': THIS_DEVICE,
      ...(enabled ? { 'skeleton.push.enabled.acc_1': '1' } : {}),
    }),
    api: fakePushApi({
      devices,
      preferences,
      config: {
        webPush: webPush ? { publicKey: KEY_A } : null,
        // 이 스토리집의 종류 이름
        types: ['NOTE_UPDATED', 'comment.created'],
      },
    }).api,
  }))
  return (
    <WithQuery>
      <PushSettings
        api={fake.api}
        accountId="acc_1"
        env={fake.env}
        storage={fake.storage}
        labels={{
          ...koPushLabels,
          settings: {
            ...koPushLabels.settings,
            types: {
              ...koPushLabels.settings.types,
              names: { NOTE_UPDATED: '노트 수정', 'comment.created': '새 댓글' },
            },
          },
        }}
        formatTime={(iso) => iso.slice(0, 10)}
      />
    </WithQuery>
  )
}

/**
 * 설정 칸 — 이 기기 스위치(까닭 안내 포함) · 시험 알림 · 내 다른 기기 표 · 종류별 푸시 스위치. 카드 안에 넣는다.
 * 문구는 `labels`(ko/en 모음 `koPushLabels`)로 바꾼다. 종류 이름은 `labels.settings.types.names` 로 번역해 넘긴다.
 */
const meta = {
  title: 'Packages/push/PushSettings',
  component: PushSettings,
  args: { api: fakePushApi().api, accountId: 'acc_1' },
  render: () => <Demo />,
} satisfies Meta<typeof PushSettings>
export default meta
type Story = StoryObj<typeof meta>

/** 꺼진 채로 시작 — 스위치를 누르면 권한을 묻고 켜진다. 켜지면 시험 알림 단추가 생긴다 */
export const Off: Story = {
  play: async ({ canvas, userEvent }) => {
    const sw = await canvas.findByRole('switch', { name: '이 기기에서 푸시 받기' })
    await expect(sw).not.toBeChecked()
    await expect(canvas.queryByRole('button', { name: '시험 알림 보내기' })).toBeNull()
    await userEvent.click(sw)
    await waitFor(() =>
      expect(canvas.getByRole('switch', { name: '이 기기에서 푸시 받기' })).toBeChecked(),
    )
    await userEvent.click(await canvas.findByRole('button', { name: '시험 알림 보내기' }))
    await expect(await canvas.findByText('시험 알림을 보냈어요.')).toBeVisible()
  },
}

/** 켜진 채로 — 이 기기는 표에서 빼고 다른 기기만 보인다. 지우기는 그 줄만 없앤다 */
export const OnWithOtherDevices: Story = {
  render: () => (
    <Demo
      enabled
      env={{ permission: 'granted', subscribedWith: KEY_A }}
      devices={[
        device(THIS_DEVICE, '이 노트북'),
        device('inst_work_laptop_0001', '회사 노트북'),
        device('inst_phone_android_01', null, 'FCM'),
      ]}
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByRole('switch', { name: '이 기기에서 푸시 받기' })).toBeChecked()
    await expect(await canvas.findByRole('rowheader', { name: '회사 노트북' })).toBeVisible()
    await expect(canvas.getByRole('rowheader', { name: '모바일 앱' })).toBeVisible()
    await expect(canvas.queryByText('이 노트북')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: '회사 노트북 지우기' }))
    await waitFor(() => expect(canvas.queryByRole('rowheader', { name: '회사 노트북' })).toBeNull())
    await expect(canvas.getByRole('rowheader', { name: '모바일 앱' })).toBeVisible()
  },
}

/** 켠 뒤 끄면 기기를 지우고 스위치가 꺼진다 */
export const TurnOff: Story = {
  render: () => <Demo enabled env={{ permission: 'granted', subscribedWith: KEY_A }} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('switch', { name: '이 기기에서 푸시 받기' }))
    await waitFor(() =>
      expect(canvas.getByRole('switch', { name: '이 기기에서 푸시 받기' })).not.toBeChecked(),
    )
  },
}

/** 브라우저에서 거절됨 — 켜는 스위치 대신 허용하는 법을 안내한다 */
export const Denied: Story = {
  render: () => <Demo env={{ permission: 'denied' }} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('이 브라우저에서 알림이 막혀 있어요')).toBeVisible()
    await expect(canvas.queryByRole('switch', { name: '이 기기에서 푸시 받기' })).toBeNull()
  },
}

/** iPhone · iPad 는 홈 화면에 추가한 앱에서만 된다 */
export const NeedsInstall: Story = {
  render: () => <Demo env={{ support: 'needs-install' }} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('먼저 홈 화면에 추가해 주세요')).toBeVisible()
    await expect(canvas.queryByRole('switch', { name: '이 기기에서 푸시 받기' })).toBeNull()
  },
}

/** 서비스 워커 · PushManager · Notification 중 없는 브라우저 */
export const Unsupported: Story = {
  render: () => <Demo env={{ support: 'unsupported' }} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('이 브라우저는 푸시 알림을 받을 수 없어요')).toBeVisible()
  },
}

/** 서버가 웹 푸시를 켜지 않았다 */
export const ServerWithoutWebPush: Story = {
  render: () => <Demo webPush={false} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('푸시 알림을 쓸 수 없어요')).toBeVisible()
  },
}

/** 종류별 스위치 — 푸시만 끄고 켠다(알림함에는 그대로 쌓인다) */
export const TypeSwitches: Story = {
  render: () => <Demo preferences={types} />,
  play: async ({ canvas, userEvent }) => {
    const note = await canvas.findByRole('switch', { name: '노트 수정' })
    await expect(note).toBeChecked()
    await expect(canvas.getByRole('switch', { name: '새 댓글' })).not.toBeChecked()
    await userEvent.click(note)
    await waitFor(() => expect(canvas.getByRole('switch', { name: '노트 수정' })).not.toBeChecked())
    await userEvent.click(canvas.getByRole('switch', { name: '새 댓글' }))
    await waitFor(() => expect(canvas.getByRole('switch', { name: '새 댓글' })).toBeChecked())
  },
}

/** 「모든 채널 끄기」를 켠 종류는 잠기고 까닭이 보인다(읽기만 — 켜고 끄는 곳은 알림 설정) */
export const AllChannelsMutedLocksTheSwitch: Story = {
  render: () => (
    <Demo
      preferences={[
        { type: 'NOTE_UPDATED', push: true, allChannelsMuted: true },
        { type: 'comment.created', push: true, allChannelsMuted: false },
      ]}
    />
  ),
  play: async ({ canvas }) => {
    const locked = await canvas.findByRole('switch', { name: '노트 수정' })
    await expect(locked).toBeDisabled()
    await expect(locked).not.toBeChecked()
    await expect(canvas.getByText('알림이 전체 꺼져 있어요.')).toBeVisible()
    await expect(canvas.getByRole('switch', { name: '새 댓글' })).toBeEnabled()
  },
}
