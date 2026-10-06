import type { Meta, StoryObj } from '@storybook/react-vite'
import { StrictMode, useMemo } from 'react'
import { expect, fn, waitFor, within } from 'storybook/test'
import { AccountStateNotice } from '../screens/AccountStateNotice'
import { AccountSettings, type AccountSettingsProps } from '../screens/AccountSettings'
import {
  createFakeAccountApi,
  FAKE_CODE,
  FAKE_SOCIAL_REAUTH,
  type FakeAccountOptions,
} from '../stories/fakeAccountApi'
import { withRouter } from '../stories/withRouter'

/**
 * 계정 설정 — 프로필(언어 · 시간대) · 비밀번호 · 이메일(새 주소의 인증번호 단계) · 로그인 수단(연결 해제는 다시 인증) · 활성 세션 · 계정 삭제(다시 인증 → 글자 입력 확인 → 유예 안내).
 * 다시 인증은 계정에 맞는 하나: 비밀번호 · 메일로 받은 6자리를 **그 자리에서** 입력 · (주소가 없는 계정) 제공자 동의. `AccountApi` 하나로 이어진다(여기서는 가짜).
 */

function Demo({ fake, ...props }: { fake?: FakeAccountOptions } & Partial<AccountSettingsProps>) {
  const api = useMemo(() => createFakeAccountApi(fake), [fake])
  return (
    <AccountSettings
      api={api}
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
  args: { onProviderReauth: fn() },
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

/** 비밀번호 계정: 새 주소 + 현재 비밀번호 → 새 주소로 간 6자리를 같은 자리에서 입력 → 바뀐다(다른 기기는 로그아웃) */
export const ChangeEmailWithCode: Story = {
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Email address' }))
    await userEvent.type(section.getByLabelText(/^New email/), 'next@example.com')
    await userEvent.type(section.getByLabelText(/^Current password/), 'old-password-1')
    await userEvent.click(section.getByRole('button', { name: 'Change email' }))
    await expect(
      await section.findByText(/We sent a 6-digit code to next@example.com/),
    ).toBeVisible()
    const first = section.getByLabelText('Digit 1 of 6')
    await userEvent.click(first)
    await userEvent.paste('000000') // 틀린 번호 — 남은 횟수와 함께
    await expect(await section.findByText(/not right\. 4 attempts left/)).toBeVisible()
    await userEvent.click(section.getByLabelText('Digit 1 of 6'))
    await userEvent.paste(FAKE_CODE)
    await expect(await section.findByText(/Your email address is changed/)).toBeVisible()
    await expect((await canvas.findAllByText('next@example.com')).length).toBeGreaterThan(0) // 현재 주소가 바뀌었다
  },
}

export const WrongPasswordKeepsTheForm: Story = {
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Email address' }))
    await userEvent.type(section.getByLabelText(/^New email/), 'next@example.com')
    await userEvent.type(section.getByLabelText(/^Current password/), 'wrong-1')
    await userEvent.click(section.getByRole('button', { name: 'Change email' }))
    await expect(await section.findByText('The current password is not correct.')).toBeVisible()
    await expect(section.getByLabelText(/^New email/)).toHaveValue('next@example.com')
  },
}

/** 새로고침 직후에도 서버(me.pendingEmail)가 말해 주는 상태 — 인증번호 단계가 바로 열린다 */
export const PendingEmailFromServer: Story = {
  args: { fake: { pendingEmail: 'next@example.com' } },
  play: async ({ canvas, userEvent }) => {
    await expect(
      await canvas.findByText(/We sent a 6-digit code to next@example.com/),
    ).toBeVisible()
    await expect(await canvas.findByText(/it works until/)).toBeVisible()
    // 「다시 받기」는 새 요청이다 — 다시 인증(비밀번호)을 거친 폼이 새 주소가 채워진 채 열린다
    await userEvent.click(canvas.getByRole('button', { name: 'Send the code again' }))
    const section = within(await canvas.findByRole('region', { name: 'Email address' }))
    await expect(await section.findByLabelText(/^New email/)).toHaveValue('next@example.com')
    await expect(section.getByLabelText(/^Current password/)).toBeVisible()
  },
}

/** 비밀번호 없는 계정(주소 있음): 같은 자리에서 코드를 받아 입력한다 — 링크 왕복 없음 */
export const PasswordlessEmailChangeByCode: Story = {
  args: { fake: { passwordless: true } },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Email address' }))
    await userEvent.type(section.getByLabelText(/^New email/), 'next@example.com')
    await userEvent.click(section.getByRole('button', { name: 'Email me a code' }))
    await expect(
      await section.findByText(/We sent a 6-digit code to ann@example.com/),
    ).toBeVisible()
    await userEvent.click(section.getAllByLabelText('Digit 1 of 6')[0])
    await userEvent.paste(FAKE_CODE)
    await expect(await section.findByText('Code entered — finish below.')).toBeVisible()
    await userEvent.click(section.getByRole('button', { name: 'Change email' }))
    await expect(
      await section.findByText(/We sent a 6-digit code to next@example.com/),
    ).toBeVisible()
  },
}

export const PasswordlessWrongReauthCodeShowsAttemptsLeft: Story = {
  args: { fake: { passwordless: true } },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Email address' }))
    await userEvent.type(section.getByLabelText(/^New email/), 'next@example.com')
    await userEvent.click(section.getByRole('button', { name: 'Email me a code' }))
    await userEvent.click(await section.findByLabelText('Digit 1 of 6'))
    await userEvent.paste('999999') // 아직 서버는 안 봤다 — 제출하면 틀린 것이 나온다
    await userEvent.click(section.getByRole('button', { name: 'Change email' }))
    await expect(await section.findByText(/not right\. 4 attempts left/)).toBeVisible()
  },
}

export const PasswordlessFirstPasswordByCode: Story = {
  args: { fake: { passwordless: true } },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Set a password' }))
    await userEvent.click(section.getByRole('button', { name: 'Email me a code' }))
    await userEvent.click(await section.findByLabelText('Digit 1 of 6'))
    await userEvent.paste(FAKE_CODE)
    await userEvent.type(section.getByLabelText(/^New password/), 'Correct-horse-battery-9')
    await userEvent.click(section.getByRole('button', { name: 'Change password' }))
    await expect(await section.findByText(/Password changed/)).toBeVisible()
  },
}

/** 주소가 없는 계정: 비밀번호는 정할 수 없다고 말하고, 이메일 변경은 이미 쓰는 제공자로 다시 동의한다(왕복은 앱이 state 에 묶는다) */
export const NoAddressAccountReconsents: Story = {
  args: { fake: { noAddress: true }, socialProviders: [{ provider: 'naver' }] },
  play: async ({ canvas, args, userEvent }) => {
    await expect(await canvas.findByText(/needs a verified email address/)).toBeVisible()
    const section = within(await canvas.findByRole('region', { name: 'Email address' }))
    await userEvent.type(section.getByLabelText(/^New email/), 'next@example.com')
    await userEvent.click(section.getByRole('button', { name: 'Confirm with Naver' }))
    await expect(args.onProviderReauth).toHaveBeenCalledWith('naver', {
      kind: 'email-change',
      newEmail: 'next@example.com',
    })
  },
}

/** LINE · X 로만 가입한 계정(이메일 주소 없음): 빈 칸이 아니라 「주소 없음」, 로그인 수단 목록에 LINE, 「이메일 추가」는 LINE 동의를 다시 거친다 */
export const AddressLessLineAccount: Story = {
  args: {
    fake: { noAddress: true, noAddressProvider: 'line' },
    socialProviders: [{ provider: 'line' }, { provider: 'x' }],
  },
  play: async ({ canvas, args, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Email address' }))
    await expect(section.getByText('No email address on this account')).toBeVisible()
    await expect(section.queryByText('Current address')).toBeNull()
    await expect(section.queryByText('Unverified')).toBeNull()
    const methods = within(await canvas.findByRole('region', { name: 'Sign-in methods' }))
    await expect(methods.getByText('LINE')).toBeVisible()
    await userEvent.type(section.getByLabelText(/^New email/), 'me@example.com')
    await userEvent.click(section.getByRole('button', { name: 'Confirm with LINE' }))
    await expect(args.onProviderReauth).toHaveBeenCalledWith('line', {
      kind: 'email-change',
      newEmail: 'me@example.com',
    })
  },
}

/** 제공자 동의에서 돌아왔다 — 이어서 새 주소로 인증번호를 요청하고 코드 단계가 열린다. 한 번만(StrictMode 에서도) */
export const NoAddressReturnsAndContinuesOnce: Story = {
  args: {
    fake: { noAddress: true },
    socialProviders: [{ provider: 'naver' }],
    resume: {
      action: { kind: 'email-change', newEmail: 'next@example.com' },
      socialReauth: FAKE_SOCIAL_REAUTH,
    },
    onResumeConsumed: fn(),
  },
  render: (args) => (
    <StrictMode>
      <Demo {...args} />
    </StrictMode>
  ),
  play: async ({ canvas, args }) => {
    await expect(
      await canvas.findByText(/We sent a 6-digit code to next@example.com/),
    ).toBeVisible()
    await expect(args.onResumeConsumed).toHaveBeenCalledTimes(1)
  },
}

export const PasswordlessLinkAsksForTheProofAfterTheProvider: Story = {
  args: {
    fake: { passwordless: true },
    socialProviders: [{ provider: 'kakao' }],
    onLinkSocial: fn(),
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Link Kakao' }))
    await expect(args.onLinkSocial).toHaveBeenCalledWith('kakao') // 증거는 제공자에 다녀온 뒤 콜백 화면이 받는다
  },
}

/** 제공자를 연결하고 돌아오면 — 서버가 계정 주소로 알림 메일을 보낸다(연결 · 병합) */
export const JustLinkedNotice: Story = {
  args: { linkedProvider: 'kakao' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/Kakao is linked.*notice/)).toBeVisible()
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
    const dialog = within(await canvas.findByRole('dialog'))
    const confirm = dialog.getByRole('button', { name: 'Remove' })
    await expect(confirm).toBeDisabled() // 다시 인증이 있어야 켜진다
    await userEvent.type(dialog.getByLabelText(/^Current password/), 'wrong-1')
    await userEvent.click(confirm)
    await expect(await dialog.findByText('The current password is not correct.')).toBeVisible()
    await userEvent.clear(dialog.getByLabelText(/^Current password/))
    await userEvent.type(dialog.getByLabelText(/^Current password/), 'old-password-1')
    await userEvent.click(confirm)
    await waitFor(() => expect(canvas.queryByText('Google')).toBeNull())
  },
}

/** 비밀번호 없는 계정(주소 있음)이 수단을 뗄 때는 메일로 받은 6자리를 창 안에서 입력한다 */
export const UnlinkNeedsTheMailedCodeForAPasswordlessAccount: Story = {
  args: { fake: { passwordless: true } },
  play: async ({ canvas, userEvent }) => {
    const rows = (await canvas.findAllByRole('listitem')).filter((li) => li.querySelector('button'))
    await userEvent.click(within(rows[0]).getByRole('button', { name: 'Remove' }))
    const dialog = within(await canvas.findByRole('dialog'))
    await expect(dialog.getByRole('button', { name: 'Remove' })).toBeDisabled()
    await userEvent.click(dialog.getByRole('button', { name: 'Email me a code' }))
    await userEvent.click(await dialog.findByLabelText('Digit 1 of 6'))
    await userEvent.paste(FAKE_CODE)
    await userEvent.click(dialog.getByRole('button', { name: 'Remove' }))
    await expect(await canvas.findByText('Removed.')).toBeVisible()
  },
}

/** 주소가 없는 계정이 수단을 뗄 때는 이미 쓰는 제공자로 다시 동의한다 */
export const UnlinkNoAddressReconsents: Story = {
  args: { fake: { noAddress: true }, socialProviders: [{ provider: 'naver' }] },
  play: async ({ canvas, args, userEvent }) => {
    const rows = (await canvas.findAllByRole('listitem')).filter((li) => li.querySelector('button'))
    await userEvent.click(within(rows[1]).getByRole('button', { name: 'Remove' }))
    const dialog = within(await canvas.findByRole('dialog'))
    await userEvent.click(dialog.getByRole('button', { name: 'Confirm with Naver' }))
    await expect(args.onProviderReauth).toHaveBeenCalledWith('naver', {
      kind: 'unlink',
      identityId: expect.any(String),
    })
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
    const typed = dialog.getByLabelText('Type DELETE to confirm')
    await userEvent.type(typed, 'delete') // 대소문자가 다르면 켜지지 않는다
    await expect(confirm).toBeDisabled()
    await userEvent.clear(typed)
    await userEvent.type(typed, 'DELETE')
    await expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    await expect(await canvas.findByText(/scheduled for erasure/)).toBeVisible()
    // 안내를 읽을 시간을 준다 — 로그아웃은 사용자가 누른다(곧바로 로그아웃하면 가드가 로그인으로 보내 안내가 보이지 않는다)
    await expect(
      within(canvas.getByRole('region', { name: 'Delete account' })).getByRole('button', {
        name: 'Sign out',
      }),
    ).toBeVisible()
  },
}

/** 비밀번호 없는 계정: 삭제용 인증번호를 받아 같은 자리에서 입력 → 글자 확인 → 유예 안내 */
export const DeletePasswordlessByCode: Story = {
  args: { fake: { passwordless: true } },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Delete account' }))
    await expect(section.queryByLabelText(/^Current password/)).toBeNull()
    await expect(section.getByRole('button', { name: 'Delete my account' })).toBeDisabled()
    await userEvent.click(section.getByRole('button', { name: 'Email me a code' }))
    await userEvent.click(await section.findByLabelText('Digit 1 of 6'))
    await userEvent.paste(FAKE_CODE)
    await userEvent.click(section.getByRole('button', { name: 'Delete my account' }))
    const dialog = within(await canvas.findByRole('dialog'))
    await userEvent.type(dialog.getByLabelText('Type DELETE to confirm'), 'DELETE')
    await userEvent.click(dialog.getByRole('button', { name: 'Delete account' }))
    await expect(await canvas.findByText(/scheduled for erasure/)).toBeVisible()
  },
}

export const DeleteWithAWrongCodeShowsAttemptsLeft: Story = {
  args: { fake: { passwordless: true } },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Delete account' }))
    await userEvent.click(section.getByRole('button', { name: 'Email me a code' }))
    await userEvent.click(await section.findByLabelText('Digit 1 of 6'))
    await userEvent.paste('111111')
    await userEvent.click(section.getByRole('button', { name: 'Delete my account' }))
    const dialog = within(await canvas.findByRole('dialog'))
    await userEvent.type(dialog.getByLabelText('Type DELETE to confirm'), 'DELETE')
    await userEvent.click(dialog.getByRole('button', { name: 'Delete account' }))
    await expect(await section.findByText(/not right\. 4 attempts left/)).toBeVisible()
    await expect(canvas.queryByText(/scheduled for erasure/)).toBeNull()
  },
}

/** 주소가 없는 계정: 제공자 동의를 다시 거쳐 돌아오면 확인했다고 말하고, 글자 확인으로 지운다 */
export const DeleteNoAddressAfterProviderReturn: Story = {
  args: {
    fake: { noAddress: true },
    socialProviders: [{ provider: 'naver' }],
    resume: { action: { kind: 'delete' }, socialReauth: FAKE_SOCIAL_REAUTH },
  },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Delete account' }))
    await expect(await section.findByText('Confirmed with Naver.')).toBeVisible()
    await userEvent.click(section.getByRole('button', { name: 'Delete my account' }))
    const dialog = within(await canvas.findByRole('dialog'))
    await userEvent.type(dialog.getByLabelText('Type DELETE to confirm'), 'DELETE')
    await userEvent.click(dialog.getByRole('button', { name: 'Delete account' }))
    await expect(await canvas.findByText(/scheduled for erasure/)).toBeVisible()
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
