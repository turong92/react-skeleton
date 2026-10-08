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
import { koAuthLabels } from '../screens/labels.ko'
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
      confirmPassword // 모듈 기본은 꺼짐 — 이 스토리들은 앱이 켠 모양
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
      'Account email',
      'Sign-in methods',
      'Active sessions',
      'Delete account',
    ])
      await expect(await canvas.findByRole('heading', { name })).toBeVisible()
  },
}

/** 주소의 해시(`/account#delete` · `#email`)가 가리키는 구역으로 스크롤하고 그 제목에 포커스를 둔다 — 「내 계정 삭제」 같은 딥링크가 도착한 자리를 낭독이 알린다 */
export const OpensOnTheSectionTheHashNames: Story = {
  beforeEach: () => {
    const before = window.location.hash
    window.history.replaceState(null, '', '#delete')
    return () => window.history.replaceState(null, '', before || window.location.pathname)
  },
  play: async ({ canvas }) => {
    const title = await canvas.findByRole('heading', { name: 'Delete account' })
    await waitFor(() => expect(title).toHaveFocus())
    const top = title.getBoundingClientRect().top
    await expect(top).toBeGreaterThanOrEqual(0)
    await expect(top).toBeLessThan(window.innerHeight)
  },
}

/**
 * 글 · 댓글의 이름을 작성 닉네임(`@skeleton/author-profile`)으로 따로 쓰는 앱 — 계정 닉네임 줄을 숨긴다(`showDisplayName={false}`): 사용자에게 닉네임이 둘이 되지 않는다.
 * 언어 · 시간대는 남는다
 */
export const WithoutTheAccountNickname: Story = {
  args: { showDisplayName: false },
  play: async ({ canvas }) => {
    const section = within(await canvas.findByRole('region', { name: 'Profile' }))
    await expect(section.queryByLabelText(/Nickname/)).toBeNull()
    await expect(section.getByLabelText('Language')).toBeVisible()
    await expect(section.getByLabelText('Time zone')).toBeVisible()
  },
}

export const ChangePassword: Story = {
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Password' }))
    await userEvent.type(section.getByLabelText(/^Current password/), 'wrong-old-1')
    await userEvent.type(section.getByLabelText(/^New password/), 'Correct-horse-battery-9')
    await userEvent.type(section.getByLabelText(/^Confirm password/), 'Correct-horse-battery-9')
    await userEvent.click(section.getByRole('button', { name: 'Change password' }))
    await expect(await section.findByText('The current password is not correct.')).toBeVisible()
    await userEvent.clear(section.getByLabelText(/^Current password/))
    await userEvent.type(section.getByLabelText(/^Current password/), 'old-password-1')
    await userEvent.click(section.getByRole('button', { name: 'Change password' }))
    await expect(await section.findByText(/Password changed/)).toBeVisible()
  },
}

/** 비밀번호 계정: 새 주소 + 현재 비밀번호 → 새 주소로 간 6자리를 같은 자리에서 입력 → 바뀐다(다른 기기는 로그아웃) */
export const ChangePasswordMismatchBlocksAndSaysWhy: Story = {
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Password' }))
    await userEvent.type(section.getByLabelText(/^Current password/), 'old-password-1')
    await userEvent.type(section.getByLabelText(/^New password/), 'Correct-horse-battery-9')
    const confirm = section.getByLabelText(/^Confirm password/)
    await expect(confirm).toHaveAttribute('autocomplete', 'new-password')
    await userEvent.type(confirm, 'Correct-horse-battery-8')
    await expect(await section.findByText('Passwords do not match')).toBeVisible()
    await userEvent.click(section.getByRole('button', { name: 'Change password' }))
    await expect(
      await section.findByRole('button', { name: 'Passwords do not match' }),
    ).toBeVisible()
    await waitFor(() => expect(confirm).toHaveFocus())
    await expect(section.queryByText(/Password changed/)).toBeNull() // 서버로 가지 않았다
    // 보기 하나가 새 비밀번호 두 칸을 함께 보인다
    // (현재 비밀번호 칸의 토글이 먼저 있다 — 새 비밀번호 칸의 것은 마지막)
    await userEvent.click(section.getAllByRole('button', { name: 'Show' }).at(-1)!)
    await expect(confirm).toHaveAttribute('type', 'text')
    await expect(section.getByLabelText(/^New password/)).toHaveAttribute('type', 'text')
    // 맞게 고치면 바뀌고 두 칸이 함께 비워진다
    await userEvent.clear(confirm)
    await userEvent.type(confirm, 'Correct-horse-battery-9')
    await userEvent.click(section.getByRole('button', { name: 'Change password' }))
    await expect(await section.findByText(/Password changed/)).toBeVisible()
    await expect(section.getByLabelText(/^New password/)).toHaveValue('')
    await expect(section.getByLabelText(/^Confirm password/)).toHaveValue('')
  },
}

/** 현재 비밀번호 없이 「비밀번호 변경」 — 꺼진 버튼이 아니라 이유를 말하고 그 칸으로 데려간다 */
export const ChangePasswordWithoutTheProofExplainsItself: Story = {
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Password' }))
    const submit = section.getByRole('button', { name: 'Change password' })
    await expect(submit).toBeEnabled()
    await userEvent.click(submit)
    await expect(
      await section.findByRole('button', { name: 'Confirm it is you first (see above)' }),
    ).toBeVisible()
    await expect(section.getByRole('button', { name: 'Enter your password' })).toBeVisible()
    await waitFor(() => expect(section.getByLabelText(/^Current password/)).toHaveFocus())
  },
}

export const ChangeEmailWithoutAddressOrProofExplainsItself: Story = {
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Account email' }))
    await userEvent.click(section.getByRole('button', { name: 'Change email' }))
    await expect(
      await section.findByRole('button', { name: 'Enter your email address' }),
    ).toBeVisible()
    await expect(
      section.getByRole('button', { name: 'Confirm it is you first (see above)' }),
    ).toBeVisible()
    await waitFor(() => expect(section.getByLabelText(/^New email/)).toHaveFocus())
    await expect(section.getByLabelText(/^New email/)).toHaveAttribute('aria-invalid', 'true')
  },
}

export const DeleteBeforeTheProofExplainsItself: Story = {
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Delete account' }))
    await userEvent.click(section.getByRole('button', { name: 'Delete my account' }))
    await expect(
      await section.findByRole('button', { name: 'Confirm it is you first (see above)' }),
    ).toBeVisible()
    await waitFor(() => expect(section.getByLabelText(/^Current password/)).toHaveFocus())
    await expect(canvas.queryByRole('dialog')).toBeNull() // 확인 창은 아직
  },
}

export const ChangeEmailWithCode: Story = {
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Account email' }))
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
    const section = within(await canvas.findByRole('region', { name: 'Account email' }))
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
    const section = within(await canvas.findByRole('region', { name: 'Account email' }))
    await expect(await section.findByLabelText(/^New email/)).toHaveValue('next@example.com')
    await expect(section.getByLabelText(/^Current password/)).toBeVisible()
  },
}

/* 인증번호 남은 시간 — 이메일 변경은 서버가 준 `me.pendingEmailExpiresAt`(= 서버 값), 재인증 · 삭제 확인 · 이메일 변경 요청은 응답에 시각이 있으면 그 값, 없으면(옛 서버) 문서화된 10분으로 어림(`data-expiry-source="estimate"`) */
export const EmailChangeCodeShowsTheServerExpiry: Story = {
  args: { fake: { pendingEmail: 'next@example.com', pendingExpiresInMinutes: 9 } },
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByText(/^Time left (09:00|08:5\d)$/)).toBeVisible()
    await expect(
      canvasElement.querySelector('[data-testid="verify-code"] [data-expiry-source]'),
    ).toHaveAttribute('data-expiry-source', 'server')
  },
}

export const EmailChangeCodeExpiredLocksAndFocusesSendAgain: Story = {
  args: { fake: { pendingEmail: 'next@example.com', pendingExpiresInMinutes: 0.04 } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('alert', {}, { timeout: 6000 })).toHaveTextContent(
      'Time is up. Please get a new code.',
    )
    await expect(canvas.getByLabelText('Digit 1 of 6')).toBeDisabled()
    // 이 요청은 다시 인증이 드니 조용히 다시 보낼 수 없다 — 「다시 받기」(= 새 요청)로 포커스
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Send the code again' })).toHaveFocus(),
    )
  },
}

export const ReauthCodeCountsDownFromAnEstimatedTenMinutes: Story = {
  args: { fake: { passwordless: true } },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Account email' }))
    await userEvent.type(section.getByLabelText(/^New email/), 'next@example.com')
    await userEvent.click(section.getByRole('button', { name: 'Email me a code' }))
    await expect(await section.findByText(/^Time left (10:00|09:5\d)$/)).toBeVisible()
    // 다시 받기는 쿨다운 동안 버튼 글자에 초로
    await expect(
      section.getByRole('button', { name: /^Send a new code \(\d+ s\)$/ }),
    ).toBeDisabled()
  },
}

export const DeleteCodeCountsDownFromAnEstimatedTenMinutes: Story = {
  args: { fake: { passwordless: true } },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Delete account' }))
    await userEvent.click(section.getByRole('button', { name: 'Email me a code' }))
    await expect(await section.findByText(/^Time left (10:00|09:5\d)$/)).toBeVisible()
  },
}

/** 비밀번호 없는 계정(주소 있음): 같은 자리에서 코드를 받아 입력한다 — 링크 왕복 없음 */
export const PasswordlessEmailChangeByCode: Story = {
  args: { fake: { passwordless: true } },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Account email' }))
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
    const section = within(await canvas.findByRole('region', { name: 'Account email' }))
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
    await userEvent.type(section.getByLabelText(/^Confirm password/), 'Correct-horse-battery-9')
    await userEvent.click(section.getByRole('button', { name: 'Change password' }))
    await expect(await section.findByText(/Password changed/)).toBeVisible()
  },
}

/** 주소가 없는 계정(이메일을 필수로 켜지 않은 앱): 비밀번호는 정할 수 없다고 말하고, 이메일 추가는 이미 쓰는 제공자로 먼저 다시 동의한다 - 주소를 적으면 제공자 단추가 바로 나온다(왕복은 앱이 state 에 묶는다) */
export const NoAddressAccountReconsents: Story = {
  args: { fake: { noAddress: true }, socialProviders: [{ provider: 'naver' }] },
  play: async ({ canvas, args, userEvent }) => {
    await expect(await canvas.findByText(/needs a verified email address/)).toBeVisible()
    const section = within(await canvas.findByRole('region', { name: 'Account email' }))
    await expect(section.getByText(/confirm it is you with your current sign-in/)).toBeVisible()
    await userEvent.type(section.getByLabelText(/^New email/), 'next@example.com')
    await userEvent.click(await section.findByRole('button', { name: 'Confirm with Naver' }))
    await expect(args.onProviderReauth).toHaveBeenCalledWith('naver', {
      kind: 'email-change',
      newEmail: 'next@example.com',
    })
  },
}

/** 이메일을 필수로 켠 앱: 첫 등록은 다시 인증 없이 보낸다 - 이 가짜 서버는 1시간이 지난 것처럼 `REAUTH_REQUIRED` 로 답하고, 그제서야 제공자 동의를 안내한다 */
export const RequiredAppAsksForTheProviderOnlyWhenTheServerSays: Story = {
  args: {
    fake: { emailRequired: true, reauthWindowExpired: true },
    socialProviders: [{ provider: 'kakao' }],
  },
  play: async ({ canvas, args, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Account email' }))
    await expect(section.queryByRole('button', { name: 'Confirm with Kakao' })).toBeNull()
    await userEvent.type(section.getByLabelText(/^New email/), 'next@example.com')
    await userEvent.click(section.getByRole('button', { name: 'Add email' }))
    await expect(await section.findByText(/confirm once more with Kakao/)).toBeVisible()
    await userEvent.click(await section.findByRole('button', { name: 'Confirm with Kakao' }))
    await expect(args.onProviderReauth).toHaveBeenCalledWith('kakao', {
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
    const section = within(await canvas.findByRole('region', { name: 'Account email' }))
    await expect(section.getByText('No email address on this account')).toBeVisible()
    await expect(section.queryByText('Current address')).toBeNull()
    await expect(section.queryByText('Unverified')).toBeNull()
    const methods = within(await canvas.findByRole('region', { name: 'Sign-in methods' }))
    await expect(methods.getByText('LINE')).toBeVisible()
    await userEvent.type(section.getByLabelText(/^New email/), 'me@example.com')
    await userEvent.click(await section.findByRole('button', { name: 'Confirm with LINE' }))
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

/** 「같은 이메일의 계정이 있다」 안내에서 로그인하고 온 사용자: 그 제공자의 「연결」 한 줄 + 강조된 단추(포커스) — 이미 연결됐거나 안 켠 제공자면 아무것도 더하지 않는다 */
export const ContinueLinkingAfterEmailConflict: Story = {
  args: {
    fake: { onlyMethod: true },
    socialProviders: [{ provider: 'google' }, { provider: 'kakao' }],
    onLinkSocial: fn(),
    linkIntent: { provider: 'google' },
  },
  play: async ({ canvas, args, userEvent }) => {
    await expect(await canvas.findByText('Continue linking Google')).toBeVisible()
    const link = await canvas.findByRole('button', { name: 'Link Google' })
    await expect(link).toHaveAttribute('data-link-intent', 'true')
    await expect(link).toHaveFocus()
    await expect(canvas.getByRole('button', { name: 'Link Kakao' })).not.toHaveAttribute(
      'data-link-intent',
    )
    await userEvent.click(link)
    await expect(args.onLinkSocial).toHaveBeenCalledWith('google')
  },
}

/** 같은 화면의 한국어 */
export const ContinueLinkingAfterEmailConflictKorean: Story = {
  args: { ...ContinueLinkingAfterEmailConflict.args, labels: koAuthLabels },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Google 연결을 이어서 하세요')).toBeVisible()
    await expect(await canvas.findByRole('button', { name: 'Google 연결' })).toHaveFocus()
  },
}

/** Google 로 가입했는데 주소를 주지 않았다(Gmail 이 아닌 주소) — 이메일 자리는 빈칸이 아니라 「이메일 주소가 없어요」, 추가는 Google 동의를 다시 거친다 */
export const EmailLessGoogleAccount: Story = {
  args: {
    fake: { noAddress: true, noAddressProvider: 'google' },
    socialProviders: [{ provider: 'google' }],
  },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Account email' }))
    await expect(section.getByText('No email address on this account')).toBeVisible()
    await expect(section.queryByText('Current address')).toBeNull()
    await userEvent.type(section.getByLabelText(/^New email/), 'me@example.com')
    await expect(await section.findByRole('button', { name: 'Confirm with Google' })).toBeVisible()
  },
}

/** 같은 화면의 한국어 */
export const EmailLessGoogleAccountKorean: Story = {
  args: { ...EmailLessGoogleAccount.args, labels: koAuthLabels },
  play: async ({ canvas }) => {
    const section = within(await canvas.findByRole('region', { name: '계정 이메일' }))
    await expect(section.getByText('이 계정에는 이메일 주소가 없어요')).toBeVisible()
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
    // self-restore 를 켰다고 알리지 않았으면 「다시 로그인하면 취소」를 말하지 않는다 — 꺼진 서버에서 거짓이 되지 않게
    await expect(canvas.queryByText(/cancel the deletion/)).toBeNull()
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
    // 꺼져 있지 않다 — 본인 확인 전에 누르면 이유를 말한다
    await expect(section.getByRole('button', { name: 'Delete my account' })).toBeEnabled()
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

/* 백엔드가 `email/change` · `reauth/confirmation` · `delete/confirmation` 응답에 `expiresAt` 을 주면 어림 대신 그 값(`data-expiry-source="server"`) */
export const ReauthCodeUsesTheServerWindow: Story = {
  args: { fake: { passwordless: true, codeWindowMinutes: 3 } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Account email' }))
    await userEvent.type(section.getByLabelText(/^New email/), 'next@example.com')
    await userEvent.click(section.getByRole('button', { name: 'Email me a code' }))
    await expect(await section.findByText(/^Time left (03:00|02:5\d)$/)).toBeVisible()
    await expect(
      canvasElement.querySelector('[data-testid="reauth-code"] [data-expiry-source]'),
    ).toHaveAttribute('data-expiry-source', 'server')
  },
}

export const DeleteCodeUsesTheServerWindow: Story = {
  args: { fake: { passwordless: true, codeWindowMinutes: 3 } },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Delete account' }))
    await userEvent.click(section.getByRole('button', { name: 'Email me a code' }))
    await expect(await section.findByText(/^Time left (03:00|02:5\d)$/)).toBeVisible()
  },
}

export const EmailChangeRequestUsesTheServerWindow: Story = {
  args: { fake: { codeWindowMinutes: 4 } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Account email' }))
    await userEvent.type(section.getByLabelText(/^New email/), 'next@example.com')
    await userEvent.type(section.getByLabelText(/^Current password/), 'old-password-1')
    await userEvent.click(section.getByRole('button', { name: /^(Change|Send)/ }))
    // 요청 직후(`me` 가 다시 읽히기 전)의 창은 서버 응답의 값 — 어림이 아니다
    await expect(await canvas.findByText(/^Time left (04:00|03:5\d|03:4\d)$/)).toBeVisible()
    await expect(
      canvasElement.querySelector('[data-testid="verify-code"] [data-expiry-source]'),
    ).toHaveAttribute('data-expiry-source', 'server')
  },
}

/** 정지된 계정은 스스로 탈퇴할 수 없다(403 ACCOUNT.SUSPENDED_CANNOT_DELETE) — 일반 오류 문구가 아니라 이유를 말한다 */
export const SuspendedAccountCannotDelete: Story = {
  args: { fake: { suspended: true } },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Delete account' }))
    await userEvent.type(section.getByLabelText(/^Current password/), 'old-password-1')
    await userEvent.click(section.getByRole('button', { name: 'Delete my account' }))
    const dialog = within(await canvas.findByRole('dialog'))
    await userEvent.type(dialog.getByLabelText('Type DELETE to confirm'), 'DELETE')
    await userEvent.click(dialog.getByRole('button', { name: 'Delete account' }))
    await expect(await canvas.findByText('A suspended account cannot be deleted.')).toBeVisible()
    await expect(canvas.queryByText('Something went wrong. Try again.')).toBeNull()
  },
}

/** 정지된 계정이 삭제용 인증번호를 받으려 할 때도(`delete/confirmation`) 같은 이유 */
export const SuspendedAccountCannotAskForTheDeleteCode: Story = {
  args: { fake: { suspended: true, passwordless: true } },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Delete account' }))
    await userEvent.click(section.getByRole('button', { name: 'Email me a code' }))
    await expect(await canvas.findByText('A suspended account cannot be deleted.')).toBeVisible()
  },
}

/** 유예 안내는 서버가 self-restore 를 켰다고 앱이 알릴 때만 「다시 로그인하면 취소」를 말한다 — 꺼진 서버에서는 거짓이 되지 않게 말하지 않는다 */
export const DeletionNoticeMentionsSelfRestoreOnlyWhenOn: Story = {
  args: { selfRestore: true },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Delete account' }))
    await userEvent.type(section.getByLabelText(/^Current password/), 'old-password-1')
    await userEvent.click(section.getByRole('button', { name: 'Delete my account' }))
    const dialog = within(await canvas.findByRole('dialog'))
    await userEvent.type(dialog.getByLabelText('Type DELETE to confirm'), 'DELETE')
    await userEvent.click(dialog.getByRole('button', { name: 'Delete account' }))
    await expect(await canvas.findByText(/scheduled for erasure/)).toBeVisible()
    await expect(
      canvas.getByText(/Sign in again within that time and you can cancel the deletion\./),
    ).toBeVisible()
  },
}

/** 프로필 — 서버가 꼬리표를 붙이면 「다른 사람에게 보이는 이름」 줄에 `닉네임#번호` 가 한 덩어리로 보이고 복사할 수 있다 */
export const NicknameWithTheServerTag: Story = {
  args: { fake: { displayTag: '4821' } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Ann#4821')).toBeVisible()
    await expect(canvas.getByLabelText('Nickname')).toHaveValue('Ann')
    await expect(canvas.getByRole('button', { name: 'Copy' })).toBeVisible()
  },
}

/** 닉네임 중복 금지(서버 선택 기능) — 저장하면 409 `ACCOUNT.DISPLAY_NAME_TAKEN` 이 칸 아래에 그대로 보이고 입력은 남는다 */
export const NicknameTakenShowsUnderTheField: Story = {
  args: { fake: { takenNicknames: ['Bob'] } },
  play: async ({ canvas, userEvent }) => {
    const field = await canvas.findByLabelText('Nickname')
    await userEvent.clear(field)
    await userEvent.type(field, '  Bob  ')
    const profile = within(canvas.getByRole('form', { name: 'Profile' }))
    await userEvent.click(profile.getByRole('button', { name: 'Save' }))
    await expect(await profile.findByText('That nickname is already taken.')).toBeVisible()
    await expect(field).toHaveValue('  Bob  ')
    await expect(field).toHaveAccessibleDescription(/already taken/)
    await expect(field).toHaveAttribute('aria-invalid', 'true')
  },
}

export const NicknameSaves: Story = {
  play: async ({ canvas, userEvent }) => {
    const field = await canvas.findByLabelText('Nickname')
    await userEvent.clear(field)
    await userEvent.type(field, '  Annie  ')
    const profile = within(canvas.getByRole('form', { name: 'Profile' }))
    await userEvent.click(profile.getByRole('button', { name: 'Save' }))
    await expect(await profile.findByText('Profile saved.')).toBeVisible()
  },
}

/** 닉네임 변경 한도(FINAL-5 R3, `429 ACCOUNT.RATE_LIMITED` + `retryAfterSeconds`) — 칸 아래에 기다릴 시간과 함께(서버의 영어 문장이 아니라 우리 문구) */
export const NicknameChangeLimitNamesTheWait: Story = {
  args: { fake: { nicknameChangeLimit: 1 } },
  play: async ({ canvas, userEvent }) => {
    const field = await canvas.findByLabelText('Nickname')
    const profile = within(canvas.getByRole('form', { name: 'Profile' }))
    await userEvent.clear(field)
    await userEvent.type(field, 'Annie')
    await userEvent.click(profile.getByRole('button', { name: 'Save' }))
    await expect(await profile.findByText('Profile saved.')).toBeVisible()
    await userEvent.clear(field)
    await userEvent.type(field, 'Anna')
    await userEvent.click(profile.getByRole('button', { name: 'Save' }))
    await expect(
      await profile.findByText('You changed your nickname too often. Try again in 3 h 12 min.'),
    ).toBeVisible()
    await expect(field).toHaveValue('Anna')
    await expect(field).toHaveAttribute('aria-invalid', 'true')
  },
}

/** `#` · `@` 는 보내기 전에 서버 규칙과 같은 문구로 바로 알린다 — 👩‍💻 같은 조합 이모지는 막지 않는다 */
export const NicknameSymbolsAreRefusedAtOnceEmojiAreFine: Story = {
  play: async ({ canvas, userEvent }) => {
    const field = await canvas.findByLabelText('Nickname')
    const profile = within(canvas.getByRole('form', { name: 'Profile' }))
    await userEvent.clear(field)
    await userEvent.type(field, 'an#na')
    await userEvent.click(profile.getByRole('button', { name: 'Save' }))
    await expect(
      await profile.findByText('Characters like # and @ and invisible characters are not allowed'),
    ).toBeVisible()
    await userEvent.clear(field)
    await userEvent.type(field, '👩‍💻 anna')
    await userEvent.click(profile.getByRole('button', { name: 'Save' }))
    await expect(await profile.findByText('Profile saved.')).toBeVisible()
  },
}

/** 서버의 규칙 위반(`400`, 필드 `displayName`, 코드 `Reserved`)도 서버의 영어 message 가 아니라 우리 문구로 */
export const NicknameReservedByTheServerUsesOurSentence: Story = {
  args: { fake: { reservedNicknames: ['admin'] } },
  play: async ({ canvas, userEvent }) => {
    const field = await canvas.findByLabelText('Nickname')
    const profile = within(canvas.getByRole('form', { name: 'Profile' }))
    await userEvent.clear(field)
    await userEvent.type(field, 'admin')
    await userEvent.click(profile.getByRole('button', { name: 'Save' }))
    await expect(await profile.findByText('That nickname cannot be used')).toBeVisible()
    await expect(profile.queryByText(/English from the server/)).toBeNull()
  },
}

/** 서버가 이 시도는 더 다시 보낼 수 없다고 알렸다(`resendAvailableAt: null`) — 이메일 변경의 인증번호 단계 */
export const EmailChangeCodeWithNoMoreResends: Story = {
  args: { fake: { resendExhausted: true, codeWindowMinutes: 10 } },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Account email' }))
    await userEvent.type(section.getByLabelText(/^New email/), 'next@example.com')
    await userEvent.type(section.getByLabelText(/^Current password/), 'old-password-1')
    await userEvent.click(section.getByRole('button', { name: 'Change email' }))
    await expect(
      await section.findByText(/We sent a 6-digit code to next@example.com/),
    ).toBeVisible()
    await expect(
      await section.findByText(/This code cannot be sent again\. When it expires, start over/),
    ).toBeVisible()
    await expect(section.queryByRole('button', { name: /Send a new code/ })).toBeNull()
  },
}

/** 삭제 확인 코드도 같다 — 더 다시 보낼 수 없으면 「다시 받기」는 없고 안내만(다시 인증 · 삭제 확인 모두 `ReauthProof`) */
export const DeleteCodeWithNoMoreResends: Story = {
  args: { fake: { passwordless: true, resendExhausted: true, codeWindowMinutes: 10 } },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Delete account' }))
    await userEvent.click(section.getByRole('button', { name: 'Email me a code' }))
    await expect(await section.findByLabelText('Digit 1 of 6')).toBeVisible()
    await expect(
      await section.findByText(/This code cannot be sent again\. When it expires, start over/),
    ).toBeVisible()
    await expect(section.queryByRole('button', { name: /Send a new code/ })).toBeNull()
  },
}

/** 프로필을 저장하면 앱에 알린다(`onProfileChanged`) — 앱이 자기 쪽 프로필 캐시 · 작성자 이름이 걸린 화면을 다시 읽게 한다 */
export const ProfileSaveNotifiesTheApp: Story = {
  args: { onProfileChanged: fn() },
  play: async ({ canvas, args, userEvent }) => {
    const field = await canvas.findByLabelText('Nickname')
    const profile = within(canvas.getByRole('form', { name: 'Profile' }))
    await userEvent.clear(field)
    await userEvent.type(field, 'Annie')
    await userEvent.click(profile.getByRole('button', { name: 'Save' }))
    await expect(await profile.findByText('Profile saved.')).toBeVisible()
    await expect(args.onProfileChanged).toHaveBeenCalledTimes(1)
    await expect(args.onProfileChanged).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Annie' }),
    )
  },
}

/* ───────── 이메일 두 구역: 「계정 이메일」(로그인 · 비밀번호 찾기 · 보안 알림) / 「연락받을 이메일」(선택 — 공지 · 서비스 알림) ───────── */

/** 이메일을 필수로 켠 앱의 계정 이메일: 쓰임을 말하고, 지울 수 없다고 말한다 — 바꾸는 단추만 있다 */
export const AccountEmailSaysWhatItIsFor: Story = {
  args: { fake: { emailRequired: false, firstRegistrationOpen: true } },
  play: async ({ canvas }) => {
    const section = within(await canvas.findByRole('region', { name: 'Account email' }))
    await expect(
      section.getByText('Used to sign in, to find your password and for security notices.'),
    ).toBeVisible()
    await expect(section.getByRole('button', { name: 'Change email' })).toBeVisible()
    await expect(section.queryByRole('button', { name: /Remove|Delete/ })).toBeNull()
  },
}

/** 연락받을 이메일 — 앱이 켠다(`contactEmail`). 없으면 「계정 이메일로 받아요」, 등록은 주소 → 그 주소로 간 인증번호 → 끝 */
export const ContactEmailRegister: Story = {
  args: { contactEmail: true },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Contact email' }))
    await expect(section.getByText('Notices go to your account email')).toBeVisible()
    await expect(section.getByText(/not used to sign in or to find your password/)).toBeVisible()
    await userEvent.click(section.getByRole('button', { name: 'Add a contact email' }))
    await waitFor(() => expect(section.getByLabelText(/^Contact email/)).toHaveFocus())
    // 형식이 틀리면 이유를 말하고 그 칸으로 간다 — 단추는 눌린다
    await userEvent.type(section.getByLabelText(/^Contact email/), 'nope')
    await userEvent.click(section.getByRole('button', { name: 'Send me a code' }))
    await expect(
      await section.findByRole('button', { name: 'Enter a valid email address' }),
    ).toBeVisible()
    await userEvent.clear(section.getByLabelText(/^Contact email/))
    await userEvent.type(section.getByLabelText(/^Contact email/), 'news@example.com')
    await userEvent.click(section.getByRole('button', { name: 'Send me a code' }))
    await expect(
      await section.findByText(/We sent a 6-digit code to news@example.com/),
    ).toBeVisible()
    await waitFor(() => expect(section.getAllByLabelText('Digit 1 of 6')[0]).toHaveFocus())
    await userEvent.click(section.getAllByLabelText('Digit 1 of 6')[0])
    await userEvent.paste('000000')
    await expect(await section.findByText(/not right\. 4 attempts left/)).toBeVisible()
    await userEvent.click(section.getAllByLabelText('Digit 1 of 6')[0])
    await userEvent.paste(FAKE_CODE)
    await expect(await section.findByText('Your contact email is saved.')).toBeVisible()
    await expect(section.getByText('news@example.com')).toBeVisible()
    await expect(section.getByText(/Security mail always goes to your account email/)).toBeVisible()
    // 계정 이메일은 그대로다
    const account = within(canvas.getByRole('region', { name: 'Account email' }))
    await expect(account.getByText('ann@example.com')).toBeVisible()
  },
}

/** 연락받을 이메일이 있다: 바꾸기(같은 인증번호 흐름) · 지우기(바로 — 알림은 다시 계정 이메일로) */
export const ContactEmailChangeAndRemove: Story = {
  args: { contactEmail: true, fake: { contactEmail: 'old@example.com' } },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Contact email' }))
    await expect(section.getByText('old@example.com')).toBeVisible()
    await userEvent.click(section.getByRole('button', { name: 'Change' }))
    await userEvent.type(await section.findByLabelText(/^Contact email/), 'new@example.com')
    await userEvent.click(section.getByRole('button', { name: 'Send me a code' }))
    await userEvent.click((await section.findAllByLabelText('Digit 1 of 6'))[0])
    await userEvent.paste(FAKE_CODE)
    await expect(await section.findByText('new@example.com')).toBeVisible()
    await expect(section.queryByText('old@example.com')).toBeNull()
    await waitFor(() => expect(section.getByRole('button', { name: 'Change' })).toHaveFocus())
    await userEvent.click(section.getByRole('button', { name: 'Remove' }))
    await expect(await section.findByText(/Your contact email is removed/)).toBeVisible()
    await expect(section.getByText('Notices go to your account email')).toBeVisible()
    await expect(section.queryByText('new@example.com')).toBeNull()
  },
}

/** 등록하다 주소를 잘못 썼다 / 그만둔다 — 처음 모습으로 돌아가 포커스는 단추에 */
export const ContactEmailCancelKeepsWhatWas: Story = {
  args: { contactEmail: true, fake: { contactEmail: 'old@example.com' } },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Contact email' }))
    await userEvent.click(section.getByRole('button', { name: 'Change' }))
    await userEvent.click(await section.findByRole('button', { name: 'Cancel' }))
    await expect(section.getByText('old@example.com')).toBeVisible()
    await waitFor(() => expect(section.getByRole('button', { name: 'Change' })).toHaveFocus())
  },
}

/** 이 서버는 연락받을 이메일을 껐다 - `me` 에 `contactEmail` 키가 없다(키 없음 = 꺼짐, null = 아직 없음). 앱이 켜 두어도 구역을 처음부터 그리지 않는다 */
export const ContactEmailServerOffHidesTheSection: Story = {
  args: { contactEmail: true, fake: { contactEmailOff: true } },
  play: async ({ canvas }) => {
    await canvas.findByRole('region', { name: 'Account email' })
    await expect(canvas.queryByRole('region', { name: 'Contact email' })).toBeNull()
  },
}

/** 옛 서버는 꺼져 있어도 `contactEmail: null` 을 쓴다 - 구역이 그려지고 첫 요청이 404 를 받으면 스스로 사라진다 */
export const ContactEmailLegacyServerOffHidesTheSectionOnThe404: Story = {
  args: { contactEmail: true, fake: { contactEmailLegacyOff: true } },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Contact email' }))
    await userEvent.click(section.getByRole('button', { name: 'Add a contact email' }))
    await userEvent.type(await section.findByLabelText(/^Contact email/), 'news@example.com')
    await userEvent.click(section.getByRole('button', { name: 'Send me a code' }))
    await waitFor(() => expect(canvas.queryByRole('region', { name: 'Contact email' })).toBeNull())
    await expect(canvas.getByRole('region', { name: 'Account email' })).toBeVisible()
  },
}

/** 계정 이메일이 없는 계정(이메일을 필수로 켜지 않은 앱)은 연락받을 이메일 요청에도 제공자 재동의가 든다 - 서버가 `REAUTH_REQUIRED` 를 말하면 제공자 단추가 나온다 */
export const ContactEmailWithoutAnAccountAddressAsksTheProvider: Story = {
  args: {
    contactEmail: true,
    fake: { noAddress: true },
    socialProviders: [{ provider: 'naver' }],
  },
  play: async ({ canvas, args, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Contact email' }))
    await userEvent.click(section.getByRole('button', { name: 'Add a contact email' }))
    await userEvent.type(await section.findByLabelText(/^Contact email/), 'news@example.com')
    await userEvent.click(section.getByRole('button', { name: 'Send me a code' }))
    await userEvent.click(await section.findByRole('button', { name: 'Confirm with Naver' }))
    await expect(args.onProviderReauth).toHaveBeenCalledWith('naver', {
      kind: 'contact-email',
      email: 'news@example.com',
    })
  },
}

/** 제공자 동의에서 돌아왔다 - 증명을 실어 요청이 한 번 나가고 코드 단계가 열린다 */
export const ContactEmailReturnsFromTheProviderAndSendsTheCode: Story = {
  args: {
    contactEmail: true,
    fake: { noAddress: true },
    socialProviders: [{ provider: 'naver' }],
    resume: {
      action: { kind: 'contact-email', email: 'news@example.com' },
      socialReauth: FAKE_SOCIAL_REAUTH,
    },
  },
  play: async ({ canvas }) => {
    const section = within(await canvas.findByRole('region', { name: 'Contact email' }))
    await expect(await section.findByText(/news@example.com/)).toBeVisible()
    await expect(section.getByLabelText('Digit 1 of 6')).toBeVisible()
  },
}

/** 앱이 안 켜면(기본) 구역이 없다 */
export const ContactEmailIsOffByDefault: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('region', { name: 'Account email' })
    await expect(canvas.queryByRole('region', { name: 'Contact email' })).toBeNull()
  },
}

/** 같은 두 구역의 한국어 */
export const EmailSectionsKorean: Story = {
  args: { contactEmail: true, labels: koAuthLabels },
  play: async ({ canvas }) => {
    const account = within(await canvas.findByRole('region', { name: '계정 이메일' }))
    await expect(account.getByText('로그인, 비밀번호 찾기, 보안 알림에 쓰여요.')).toBeVisible()
    await expect(account.getByRole('button', { name: '이메일 바꾸기' })).toBeVisible()
    const contact = within(canvas.getByRole('region', { name: '연락받을 이메일' }))
    await expect(contact.getByText('계정 이메일로 받아요')).toBeVisible()
    await expect(contact.getByRole('button', { name: '연락받을 이메일 등록' })).toBeVisible()
  },
}

/** 주소가 없던 계정이 설정에서 첫 이메일을 등록한다 — 다시 인증 없이 주소 → 인증번호. 번호가 안 올 때의 안내가 같이 있다 */
export const FirstEmailFromSettings: Story = {
  args: {
    fake: { emailRequired: true, firstRegistrationOpen: true },
    socialProviders: [{ provider: 'naver' }],
  },
  play: async ({ canvas, userEvent }) => {
    const section = within(await canvas.findByRole('region', { name: 'Account email' }))
    await userEvent.type(section.getByLabelText(/^New email/), 'first@example.com')
    await userEvent.click(section.getByRole('button', { name: 'Add email' }))
    await expect(
      await section.findByText(/We sent a 6-digit code to first@example.com/),
    ).toBeVisible()
    await expect(section.getByText(/An account may already exist for that address/)).toBeVisible()
    await userEvent.click(section.getAllByLabelText('Digit 1 of 6')[0])
    await userEvent.paste(FAKE_CODE)
    await expect(await section.findByText(/Your email address is changed/)).toBeVisible()
  },
}

/** 이메일이 필수인 앱에서 주소 없는 계정이 설정을 열었다: 이메일 등록과 계정 삭제만(나머지는 서버가 403) — 등록되면 모든 구역이 열리고 앱에 알린다 */
export const RequiredEmailOpensOnlyRegisterAndDelete: Story = {
  args: {
    contactEmail: true,
    onEmailRegistered: fn(),
    fake: { emailRequired: true },
    socialProviders: [{ provider: 'kakao' }],
  },
  play: async ({ canvas, args, userEvent }) => {
    await expect(
      await canvas.findByText(/you can only add it here or delete your account/),
    ).toBeVisible()
    await expect(canvas.queryByRole('heading', { name: 'Sign-in methods' })).toBeNull()
    await expect(canvas.queryByRole('heading', { name: 'Contact email' })).toBeNull()
    await expect(canvas.getByRole('heading', { name: 'Delete account' })).toBeVisible()
    const section = within(canvas.getByRole('region', { name: 'Account email' }))
    await userEvent.type(section.getByLabelText(/^New email/), 'first@example.com')
    await userEvent.click(section.getByRole('button', { name: 'Add email' }))
    await userEvent.click((await section.findAllByLabelText('Digit 1 of 6'))[0])
    await userEvent.paste(FAKE_CODE)
    await expect(await section.findByText(/Your email address is changed/)).toBeVisible()
    await expect(args.onEmailRegistered).toHaveBeenCalledTimes(1)
    await expect(await canvas.findByRole('heading', { name: 'Sign-in methods' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Contact email' })).toBeVisible()
  },
}

// ───────────────────────── 로그인 아이디 (서버가 켠 앱: me.loginId 키가 있다) ─────────────────────────

/**
 * 정한 아이디: 값 + 「바꿀 수 없어요」 — 고치는 입력도 단추도 없다. 아이디를 켜지 않은 서버(키 없음)에서는 이 줄 자체가 없다.
 * 비밀번호가 있으니 안내도 없다.
 */
export const LoginIdFixed: Story = {
  args: { fake: { loginId: { value: 'Sumin.Kim' } } },
  play: async ({ canvas }) => {
    const row = within(await canvas.findByRole('region', { name: 'Username' }))
    await expect(row.getByText('sumin.kim')).toBeVisible()
    await expect(row.getByText('Cannot be changed')).toBeVisible()
    await expect(row.queryByRole('textbox')).toBeNull()
    await expect(row.queryByRole('button')).toBeNull()
    await expect(row.queryByText(/You sign in with/)).toBeNull()
    // 나머지 구역은 그대로 열려 있다
    await expect(canvas.getByRole('heading', { name: 'Password' })).toBeVisible()
  },
}

/** 키가 없는 서버(꺼진 서버 · 옛 서버) — 아이디 줄도 목차 항목도 없다. 지금 화면 그대로 */
export const NoLoginIdWhenTheServerHasItOff: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Profile' })
    await expect(canvas.queryByRole('region', { name: 'Username' })).toBeNull()
    await expect(canvas.queryByRole('link', { name: 'Username' })).toBeNull()
  },
}

/** 소셜로만 들어온 계정(주소는 있다): 안내 + 테두리 단추 「비밀번호 만들기」 → 비밀번호 구역으로 가서 제목에 포커스 */
export const LoginIdSocialOnlyWithAnAddress: Story = {
  args: { fake: { passwordless: true, loginId: { value: 'sumin.kim' } } },
  play: async ({ canvas, userEvent }) => {
    const row = within(await canvas.findByRole('region', { name: 'Username' }))
    await expect(
      row.getByText(
        'You sign in with Google now. Set a password to sign in with your username or email too.',
      ),
    ).toBeVisible()
    await expect(row.queryByRole('button', { name: 'Register an email' })).toBeNull()
    const button = row.getByRole('button', { name: 'Set a password' })
    await expect(button).toHaveAttribute('data-variant', 'secondary') // 글자만 있는 단추가 아니다
    await userEvent.click(button)
    const title = await canvas.findByRole('heading', { name: 'Set a password' }) // 비밀번호가 없는 계정의 구역 제목
    await waitFor(() => expect(title).toHaveFocus())
  },
}

/** 소셜로만 들어오고 주소도 없는 계정(쓰기 때 방식): 「이메일 등록하기」 → 이메일 구역 · 그 구역은 왜 필요한지 한 줄을 말한다 */
export const LoginIdSocialOnlyWithoutAnAddress: Story = {
  args: {
    fake: { emailRequiredToWrite: true, loginId: { value: 'sumin.kim' } },
    socialProviders: [{ provider: 'kakao' }],
  },
  play: async ({ canvas, userEvent }) => {
    const row = within(await canvas.findByRole('region', { name: 'Username' }))
    await expect(row.getByText(/You sign in with Kakao now\./)).toBeVisible()
    await expect(row.queryByRole('button', { name: 'Set a password' })).toBeNull()
    await userEvent.click(row.getByRole('button', { name: 'Register an email' }))
    const title = await canvas.findByRole('heading', { name: 'Account email' })
    await waitFor(() => expect(title).toHaveFocus())
    const email = within(canvas.getByRole('region', { name: 'Account email' }))
    await expect(email.getByText('Register an email to start posting.')).toBeVisible()
  },
}

/** 이메일을 쓰기 때 받지 않는 앱에는 그 한 줄이 없다 */
export const EmailToWriteLineOnlyWhenTheServerAsksForIt: Story = {
  args: { fake: { noAddress: true, loginId: { value: 'sumin.kim' } } },
  play: async ({ canvas }) => {
    const email = within(await canvas.findByRole('region', { name: 'Account email' }))
    await expect(email.queryByText('Register an email to start posting.')).toBeNull()
  },
}

/**
 * 아직 안 정한 계정이 막이 걷힌 `/account` 를 열었다 — 제한 모드: 아이디 정하기 · 이메일 · 계정 삭제만.
 * (설정이 부르는 `me` · `/auth/sessions` · 비밀번호 정책은 모두 서버의 허용 목록 안이거나 로그인 없는 호출이라 403 없이 그려진다 — 오류 줄이 없다.)
 * 같은 칸 · 같은 확인 대화상자로 여기서 정하면 나머지 구역이 열린다.
 */
export const LoginIdNotChosenYetOpensOnlyChooseEmailDelete: Story = {
  args: { fake: { loginId: {} }, onLoginIdChosen: fn() },
  play: async ({ canvas, args, userEvent }) => {
    const row = within(await canvas.findByRole('region', { name: 'Username' }))
    await expect(canvas.queryByRole('alert')).toBeNull()
    await expect(canvas.queryByRole('heading', { name: 'Profile' })).toBeNull()
    await expect(canvas.queryByRole('heading', { name: 'Password' })).toBeNull()
    await expect(canvas.queryByRole('heading', { name: 'Sign-in methods' })).toBeNull()
    await expect(canvas.queryByRole('heading', { name: 'Active sessions' })).toBeNull()
    await expect(canvas.getByRole('heading', { name: 'Account email' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Delete account' })).toBeVisible()
    const submit = row.getByRole('button', { name: 'Use this username' })
    await expect(submit).toHaveAttribute('data-variant', 'primary')
    await userEvent.type(row.getByRole('textbox', { name: /^Username/ }), 'Sumin.Kim')
    await expect(await row.findByText(/This username is available/)).toBeVisible()
    await userEvent.click(submit)
    const confirm = await within(document.body).findByRole('dialog', { name: 'Use sumin.kim?' })
    await expect(within(confirm).getByText('You cannot change it afterwards.')).toBeVisible()
    await expect(args.onLoginIdChosen).not.toHaveBeenCalled()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Confirm' }))
    // 정했다 - 값이 바뀌고(고치는 요소 없음) 나머지 구역이 열린다
    const fixed = within(await canvas.findByRole('region', { name: 'Username' }))
    await expect(await fixed.findByText('sumin.kim')).toBeVisible()
    await expect(fixed.queryByRole('textbox')).toBeNull()
    await expect(await canvas.findByRole('heading', { name: 'Password' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Profile' })).toBeVisible()
    await expect(args.onLoginIdChosen).toHaveBeenCalledTimes(1)
  },
}

/** 이미 쓰는 아이디는 칸 옆 오류 - 대화상자가 닫히고 아직 정하지 않은 채 남는다 */
export const LoginIdTakenOnTheLastStepStaysUnchosen: Story = {
  args: { fake: { loginId: { takenOnConfirm: ['race.winner'] } } },
  play: async ({ canvas, userEvent }) => {
    const row = within(await canvas.findByRole('region', { name: 'Username' }))
    await userEvent.type(row.getByRole('textbox', { name: /^Username/ }), 'race.winner')
    await userEvent.click(row.getByRole('button', { name: 'Use this username' }))
    const confirm = await within(document.body).findByRole('dialog', { name: 'Use race.winner?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Confirm' }))
    // 칸 옆 오류와 위쪽 요약이 같은 말을 한다
    await expect(
      (await row.findAllByText('This username is taken or not available'))[0],
    ).toBeVisible()
    await expect(canvas.queryByRole('heading', { name: 'Password' })).toBeNull()
  },
}

/** 한국어 */
export const LoginIdKorean: Story = {
  args: {
    fake: { passwordless: true, loginId: { value: 'sumin.kim' } },
    labels: koAuthLabels,
  },
  play: async ({ canvas }) => {
    const row = within(await canvas.findByRole('region', { name: '아이디' }))
    await expect(row.getByText('바꿀 수 없어요')).toBeVisible()
    await expect(
      row.getByText(
        '지금은 Google(으)로 로그인해요. 비밀번호를 만들면 아이디나 이메일로도 로그인할 수 있어요.',
      ),
    ).toBeVisible()
    await expect(row.getByRole('button', { name: '비밀번호 만들기' })).toBeVisible()
  },
}
