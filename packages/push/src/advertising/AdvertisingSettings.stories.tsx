import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, waitFor, within } from 'storybook/test'
import { WithQuery } from '../stories/WithQuery'
import { fakeAdvertising } from '../test/fakeAdvertising'
import { AdvertisingSettings } from './AdvertisingSettings'
import { koAdvertisingLabels } from './labels'

type Seed = Parameters<typeof fakeAdvertising>[0]
type Fake = ReturnType<typeof fakeAdvertising>

const NOW = Date.parse('2026-10-01T00:00:00Z')

function Demo({
  seed,
  failRead,
  onFake,
}: {
  seed?: Seed
  failRead?: boolean
  onFake?: (f: Fake) => void
}) {
  const [fake] = useState(() => {
    const f = fakeAdvertising(seed, { failRead })
    onFake?.(f)
    return f
  })
  return (
    <WithQuery>
      <AdvertisingSettings
        push={fake.push}
        legal={fake.legal}
        labels={koAdvertisingLabels}
        locale="ko"
        now={NOW}
        formatTime={(iso) => iso.slice(0, 10)}
      />
    </WithQuery>
  )
}

/** 스토리가 가짜 서버의 기록을 볼 수 있게 — 스토리마다 새로 만든다 */
let current: Fake | null = null
const track = (f: Fake) => void (current = f)

/**
 * 광고성 푸시 수신 동의 칸 — 광고 수신 · 야간(21~08시)을 각각 따로 받는다. 처음엔 둘 다 꺼짐(미리 체크 없음),
 * 동의는 동의문을 읽고 체크한 뒤에만 기록되고, 야간은 광고 수신에 동의해야 켤 수 있다. 설정 화면의 `PushSettings` 아래에 둔다.
 */
const meta = {
  title: 'Packages/push/AdvertisingSettings',
  component: AdvertisingSettings,
  args: { push: fakeAdvertising().push, legal: fakeAdvertising().legal },
  render: () => <Demo onFake={track} />,
} satisfies Meta<typeof AdvertisingSettings>
export default meta
type Story = StoryObj<typeof meta>

const agreeDialog = async (
  canvas: ReturnType<typeof within>,
  userEvent: { click: (e: Element) => Promise<void> },
) => {
  const dialog = within(await within(document.body).findByRole('dialog'))
  const confirm = dialog.getByRole('button', { name: '동의하고 받기' })
  // 미리 체크가 없다 — 체크 전에는 동의를 기록할 수 없다
  const box = dialog.getByRole('checkbox', { name: '위 내용을 읽었고 동의합니다' })
  await expect(box).not.toBeChecked()
  await expect(confirm).toBeDisabled()
  await userEvent.click(box)
  await userEvent.click(confirm)
  void canvas
}

/** 미동의 — 둘 다 꺼짐. 스위치는 없고 「동의하기」 단추만 있고, 야간은 광고에 동의하기 전엔 잠겨 있다 */
export const NoConsent: Story = {
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('button', { name: '광고성 정보 수신 동의하기' }),
    ).toBeEnabled()
    await expect(
      canvas.getByRole('button', { name: '야간(21~08시) 광고도 받기 동의하기' }),
    ).toBeDisabled()
    await expect(canvas.getByText('광고성 정보 수신에 먼저 동의해 주세요.')).toBeVisible()
    await expect(canvas.queryByRole('switch')).toBeNull()
    await expect(current?.agreed).toEqual([])
  },
}

/** 동의하기 → 동의문 대화상자: 체크를 켜기 전엔 확인이 잠겨 있고, 기록은 `push-settings` 로 읽은 판에 남는다. 그 뒤 야간 동의가 풀린다 */
export const AgreeThenNight: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '광고성 정보 수신 동의하기' }))
    await agreeDialog(canvas, userEvent)
    await waitFor(() =>
      expect(canvas.getByRole('switch', { name: '광고성 정보 수신' })).toBeChecked(),
    )
    await expect(current?.agreed).toEqual([
      { consents: [{ type: 'marketing', version: 'v3', locale: 'ko' }], source: 'push-settings' },
    ])
    const night = canvas.getByRole('button', { name: '야간(21~08시) 광고도 받기 동의하기' })
    await expect(night).toBeEnabled()
    await userEvent.click(night)
    await agreeDialog(canvas, userEvent)
    await waitFor(() =>
      expect(canvas.getByRole('switch', { name: '야간(21~08시) 광고도 받기' })).toBeChecked(),
    )
    await expect(current?.agreed[1]).toEqual({
      consents: [{ type: 'marketing-night', version: 'v3', locale: 'ko' }],
      source: 'push-settings',
    })
  },
}

/** 동의한 상태 — 동의일 · 확인 기한과 함께 스위치가 켜져 있고, 야간은 따로 꺼져 있다 */
export const Agreed: Story = {
  render: () => (
    <Demo
      onFake={track}
      seed={{
        consent: {
          state: 'AGREED',
          effective: true,
          agreedAt: '2026-10-02T03:04:05Z',
          expiresAt: '2028-10-01T03:04:05Z',
        },
      }}
    />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('switch', { name: '광고성 정보 수신' })).toBeChecked()
    await expect(canvas.getByText(/2026-10-02에 동의 · 2028-10-01까지/)).toBeVisible()
    await expect(
      canvas.getByRole('button', { name: '야간(21~08시) 광고도 받기 동의하기' }),
    ).toBeEnabled()
  },
}

/** 야간 동의까지 — 시간대가 안내 문구에 들어간다 */
export const NightAgreed: Story = {
  render: () => (
    <Demo
      onFake={track}
      seed={{
        consent: {
          state: 'AGREED',
          effective: true,
          agreedAt: '2026-10-02T03:04:05Z',
          expiresAt: '2028-10-01T03:04:05Z',
        },
        night: {
          state: 'AGREED',
          effective: true,
          agreedAt: '2026-10-03T03:04:05Z',
          expiresAt: '2028-10-02T03:04:05Z',
        },
      }}
    />
  ),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('switch', { name: '야간(21~08시) 광고도 받기' }),
    ).toBeChecked()
    await expect(canvas.getByText(/21:00~08:00\(Asia\/Seoul\)/)).toBeVisible()
  },
}

/** 서버에 야간 동의가 남아 있어도 광고 수신이 꺼져 있으면 야간은 켜진 것으로 보이지 않고 잠긴다 */
export const NightWithoutAdvertising: Story = {
  render: () => (
    <Demo
      onFake={track}
      seed={{
        consent: { state: 'WITHDRAWN', effective: false },
        night: {
          state: 'AGREED',
          effective: true,
          agreedAt: '2026-10-03T03:04:05Z',
          expiresAt: '2028-10-02T03:04:05Z',
        },
      }}
    />
  ),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('button', { name: '야간(21~08시) 광고도 받기 동의하기' }),
    ).toBeDisabled()
    await expect(canvas.queryByRole('switch')).toBeNull()
  },
}

/** 재확인 임박 — 「수신 동의를 확인해 주세요 (D-n)」 띠. 확인하면 `source: reconfirm` 으로 기록된다 */
export const ReconfirmDue: Story = {
  render: () => (
    <Demo
      onFake={track}
      seed={{
        consent: {
          state: 'AGREED',
          effective: true,
          reconfirmDue: true,
          agreedAt: '2024-10-12T00:00:00Z',
          expiresAt: '2026-10-11T00:00:00Z',
        },
      }}
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('수신 동의를 확인해 주세요 (D-10)')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '광고성 정보 수신 확인' }))
    await agreeDialog(canvas, userEvent)
    await waitFor(() => expect(canvas.queryByText(/수신 동의를 확인해 주세요/)).toBeNull())
    await expect(current?.agreed[0]?.source).toBe('reconfirm')
  },
}

/** 동의 만료 — 광고를 받지 않는 중임을 알리고 「다시 동의」. 스위치는 꺼져 있다 */
export const Expired: Story = {
  render: () => (
    <Demo
      onFake={track}
      seed={{
        consent: {
          state: 'EXPIRED',
          effective: false,
          agreedAt: '2024-01-01T00:00:00Z',
          expiresAt: '2026-01-01T00:00:00Z',
        },
      }}
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('동의가 만료되어 광고를 받지 않고 있어요')).toBeVisible()
    await expect(canvas.queryByRole('switch')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: '광고성 정보 수신 다시 동의' }))
    await agreeDialog(canvas, userEvent)
    await waitFor(() =>
      expect(canvas.getByRole('switch', { name: '광고성 정보 수신' })).toBeChecked(),
    )
    await expect(current?.agreed[0]?.source).toBe('reconfirm')
  },
}

/** 철회 — 스위치를 끄면 바로 철회하지 않고 확인을 묻는다. 확인하면 철회 호출 뒤 「철회했어요 (일시)」 */
export const Withdraw: Story = {
  render: () => (
    <Demo
      onFake={track}
      seed={{
        consent: {
          state: 'AGREED',
          effective: true,
          agreedAt: '2026-10-02T03:04:05Z',
          expiresAt: '2028-10-01T03:04:05Z',
        },
      }}
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('switch', { name: '광고성 정보 수신' }))
    await expect(current?.withdrawn).toEqual([])
    const dialog = within(await within(document.body).findByRole('dialog'))
    await userEvent.click(dialog.getByRole('button', { name: '계속 받기' }))
    await expect(current?.withdrawn).toEqual([])
    await userEvent.click(await canvas.findByRole('switch', { name: '광고성 정보 수신' }))
    await userEvent.click(
      within(await within(document.body).findByRole('dialog')).getByRole('button', {
        name: '동의 철회',
      }),
    )
    await expect(await canvas.findByText(/^철회했어요 \(/)).toBeVisible()
    await expect(current?.withdrawn).toEqual(['marketing'])
    await expect(canvas.queryByRole('switch')).toBeNull()
  },
}

/** 서버 응답 실패 — 오류와 「다시 시도」만 보이고, 켜진 스위치도 「동의하기」도 없다(동의 상태를 모르는 채로 보여 주지 않는다) */
export const ServerError: Story = {
  render: () => <Demo onFake={track} failRead />,
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText('광고성 정보 수신 설정을 불러오지 못했어요.'),
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: '다시 시도' })).toBeVisible()
    await expect(canvas.queryByRole('switch')).toBeNull()
    await expect(canvas.queryByRole('button', { name: /동의하기/ })).toBeNull()
  },
}
