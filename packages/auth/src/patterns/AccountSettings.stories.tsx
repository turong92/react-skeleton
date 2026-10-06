import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo } from 'react'
import { expect, fn, waitFor, within } from 'storybook/test'
import { AccountStateNotice } from '../screens/AccountStateNotice'
import { AccountSettings, type AccountSettingsProps } from '../screens/AccountSettings'
import { createReauthStore } from '../reauth'
import { createReauthChannelHub } from '../reauthChannel'
import {
  createFakeAccountApi,
  FAKE_REAUTH_TOKEN,
  type FakeAccountOptions,
} from '../stories/fakeAccountApi'
import { withRouter } from '../stories/withRouter'

/**
 * 계정 설정 — 프로필(언어 · 시간대) · 비밀번호 · 이메일(확인 대기) · 로그인 수단(마지막 수단 보호) · 활성 세션(하나씩 · 한꺼번에) · 계정 삭제(다시 인증 → 글자 입력 확인 → 유예 안내).
 * `AccountApi` 하나로 이어진다(여기서는 가짜). `sections` 로 절을 끄고, 소셜 연결 버튼은 앱이 켠 제공자만 나온다.
 */
const hub = createReauthChannelHub() // 이 스토리집 한 페이지 안의 「탭」들

function Demo({ fake, ...props }: { fake?: FakeAccountOptions } & Partial<AccountSettingsProps>) {
  const api = useMemo(() => createFakeAccountApi(fake), [fake])
  const reauth = useMemo(() => createReauthStore({}), [])
  return (
    <AccountSettings
      api={api}
      reauth={reauth}
      locales={[
        { value: 'en', label: 'English' },
        { value: 'ko', label: '한국어' },
      ]}
      timeZones={['Asia/Seoul', 'UTC']}
      {...props}
    />
  )
}

const meta = {
  title: 'Patterns/Auth/Account settings',
  component: Demo,
  decorators: [withRouter],
} satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof Demo>

export const Sections: Story = {
  play: async ({ canvas }) => {
    for (const name of [
      'Profile',
      'Password',
      'Email address',
      'Sign-in methods',
      'Active sessions',
      'Delete account',
    ])
      await expect(await canvas.findByRole('heading', { name })).toBeVisible()
  },
}

export const ChangePassword: Story = {
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Password' }))
    await userEvent.type(section.getByLabelText(/^Current password/), 'wrong-old-1')
    await userEvent.type(section.getByLabelText(/^New password/), 'Correct-horse-battery-9')
    await userEvent.click(section.getByRole('button', { name: 'Change password' }))
    await expect(await section.findByText('The current password is not correct.')).toBeVisible()
    await userEvent.clear(section.getByLabelText(/^Current password/))
    await userEvent.type(section.getByLabelText(/^Current password/), 'old-password-1')
    await userEvent.click(section.getByRole('button', { name: 'Change password' }))
    await expect(await section.findByText(/Password changed/)).toBeVisible()
  },
}

export const ChangeEmailPending: Story = {
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Email address' }))
    await userEvent.type(section.getByLabelText(/^New email/), 'next@example.com')
    await userEvent.type(section.getByLabelText(/^Current password/), 'old-password-1')
    await userEvent.click(section.getByRole('button', { name: 'Change email' }))
    await expect(await section.findByText(/We sent a link to next@example.com/)).toBeVisible()
  },
}

export const PendingEmailFromServer: Story = {
  args: { fake: { pendingEmail: 'next@example.com' } },
  play: async ({ canvas }) => {
    // 새로고침 직후에도 서버(me.pendingEmail)가 말해 주는 「확인 대기」
    await expect(await canvas.findByText(/We sent a link to next@example.com/)).toBeVisible()
    await expect(await canvas.findByText(/the link works until/)).toBeVisible()
  },
}

/** 비밀번호 없는 계정: 이메일 변경은 본인 확인 메일의 링크를 거친다 — 요청 → 메일 → (링크가 토큰을 돌려준다) → 한 번 더 제출 */
export const PasswordlessEmailReauth: Story = {
  args: { fake: { passwordless: true } },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Email address' }))
    await expect(section.getByText(/We email you a confirmation link/)).toBeVisible()
    await userEvent.type(section.getByLabelText(/^New email/), 'next@example.com')
    await userEvent.click(section.getByRole('button', { name: 'Change email' }))
    await expect(await section.findByText('Check your email')).toBeVisible()
    await expect(section.getByLabelText(/^New email/)).toHaveValue('next@example.com') // 입력은 남는다
  },
}

export const PasswordlessFirstPassword: Story = {
  args: { fake: { passwordless: true } },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Set a password' }))
    await userEvent.type(section.getByLabelText(/^New password/), 'Correct-horse-battery-9')
    await userEvent.click(section.getByRole('button', { name: 'Change password' }))
    await expect(await section.findByText('Check your email')).toBeVisible()
    await expect(section.getByRole('button', { name: 'Send the link again' })).toBeVisible()
  },
}

/** 본인 확인 링크는 새 탭에서 열린다 — 그 탭이 토큰을 제안하면 하려던 작업이 있는 이 탭이 이어 간다 */
export const HandoffFromAnotherTab: Story = {
  args: { fake: { passwordless: true } },
  render: (args) => <Demo {...args} reauthChannel={hub.open()} />,
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Email address' }))
    await userEvent.type(section.getByLabelText(/^New email/), 'next@example.com')
    await userEvent.click(section.getByRole('button', { name: 'Change email' }))
    await expect(await section.findByText('Check your email')).toBeVisible()
    // 다른 탭(도착 화면)이 메일 링크의 토큰을 제안한다
    await expect(await hub.open().offer(FAKE_REAUTH_TOKEN, 1000)).toBe(true)
    await expect(await canvas.findByText(/We sent a link to next@example.com/)).toBeVisible()
    await expect(await canvas.findByText(/your email changes when you open it/i)).toBeVisible()
  },
}

export const PasswordlessLinkNeedsConfirmation: Story = {
  args: {
    fake: { passwordless: true },
    socialProviders: [{ provider: 'kakao' }],
    onLinkSocial: fn(),
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Link Kakao' }))
    await expect(
      await canvas.findByText(/We sent a confirmation link to ann@example.com/),
    ).toBeVisible()
    await expect(args.onLinkSocial).not.toHaveBeenCalled() // 제공자에는 확인 뒤에 간다
  },
}

export const LastMethodProtected: Story = {
  args: { fake: { onlyMethod: true } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/cannot be removed/)).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Remove' })).toBeNull()
  },
}

export const UnlinkAndLink: Story = {
  args: { socialProviders: [{ provider: 'google' }, { provider: 'kakao' }], onLinkSocial: fn() },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Link Kakao' }))
    await expect(args.onLinkSocial).toHaveBeenCalledWith('kakao')
    const removes = () => canvas.getAllByRole('button', { name: 'Remove' })
    await canvas.findAllByRole('listitem')
    const rows = removes().filter((b) => b.closest('li'))
    await userEvent.click(rows[rows.length - 1]) // Google 은 목록 맨 끝
    await userEvent.click(await waitFor(() => removes().find((b) => !b.closest('li'))!))
    await waitFor(() => expect(canvas.queryByText('Google')).toBeNull())
  },
}

export const Sessions: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('This device')).toBeVisible()
    await expect(canvas.getByText('Unknown device')).toBeVisible()
    await userEvent.click(canvas.getAllByRole('button', { name: 'Sign out' })[0])
    await waitFor(() => expect(canvas.queryByText('Pixel 9')).toBeNull())
    await userEvent.click(canvas.getByRole('button', { name: 'Sign out all other devices' }))
    await waitFor(() => expect(canvas.queryByText('Unknown device')).toBeNull())
  },
}

export const DeleteWithPassword: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText(/erased after 30 days/)).toBeVisible()
    const section = within(await canvas.findByRole('region', { name: 'Delete account' }))
    await userEvent.type(section.getByLabelText(/^Current password/), 'old-password-1')
    await userEvent.click(section.getByRole('button', { name: 'Delete my account' }))
    const dialog = within(await canvas.findByRole('dialog'))
    const confirm = await dialog.findByRole('button', { name: 'Delete account' })
    await expect(confirm).toBeDisabled() // 글자를 쳐야 켜진다
    await userEvent.type(dialog.getByLabelText('Type DELETE to confirm'), 'DELETE')
    await userEvent.click(confirm)
    await expect(await canvas.findByText(/scheduled for erasure/)).toBeVisible()
  },
}

export const DeletePasswordless: Story = {
  args: { fake: { passwordless: true } },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByRole('button', { name: 'Email me the link' })).toBeVisible()
    await expect(canvas.queryByLabelText(/^Current password/)).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Email me the link' }))
    await expect(await canvas.findByLabelText(/Confirmation code/)).toBeVisible()
  },
}

export const PartialSections: Story = {
  args: { sections: { delete: false, email: false, password: false } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'Profile' })).toBeVisible()
    await expect(canvas.queryByRole('heading', { name: 'Delete account' })).toBeNull()
  },
}

export const SuspendedAndBlocked: StoryObj = {
  render: () => (
    <>
      <AccountStateNotice kind="suspended" supportHref="mailto:help@example.com" />
      <AccountStateNotice kind="blocked" />
    </>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Account suspended' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Contact support' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Access blocked' })).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'Account' })).toBeVisible()
  },
}
