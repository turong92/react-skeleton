import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
import { AccountDeletedScreen } from '../screens/AccountDeletedScreen'
import { DeletionPendingScreen } from '../screens/DeletionPendingScreen'
import { MagicLinkLanding } from '../screens/MagicLinkLanding'
import { SignInScreen } from '../screens/SignInScreen'
import { SocialCallbackScreen } from '../screens/SocialCallbackScreen'
import { koAuthLabels } from '../screens/labels.ko'
import { apiError } from '../stories/fakeAccountApi'
import { withRouter } from '../stories/withRouter'

/**
 * 탈퇴 대기 중인 계정의 로그인 — 비밀번호 · 링크 · 소셜 어느 수단이든 **맞는 증거**로 들어오면 서버가 세션 대신 `403 AUTH.ACCOUNT_DELETION_PENDING`
 * (`purgeAfter`, 서버가 self-restore 를 켰을 때만 `restoreToken`)을 준다. 화면은 「탈퇴를 취소할까요?」를 묻는다: 취소하면 `delete/cancel` → 일반 로그인과 같은 처리,
 * 그대로 두면 로그인 화면으로. 토큰이 없으면 버튼 없이 안내만. 토큰은 메모리에만 있다(저장소 · 주소에 넣지 않는다 — 새로고침하면 다시 로그인).
 */
const meta = {
  title: 'Patterns/Auth/Deletion pending',
  decorators: [withRouter],
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const PURGE = '2026-11-05T00:00:00Z'
const pendingError = (restoreToken: string | null = 'restore-opaque') =>
  apiError('AUTH.ACCOUNT_DELETION_PENDING', 403, {
    purgeAfter: PURGE,
    ...(restoreToken
      ? { restoreToken, restoreTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString() }
      : {}),
  })
const pendingData = { purgeAfter: PURGE, restoreToken: 'restore-opaque' }

/** 취소를 묻는다 — 날짜는 사용자 로케일로, 취소는 토큰으로 */
export const AskToCancel: Story = {
  render: () => (
    <DeletionPendingScreen pending={pendingData} onCancel={onCancelAsk} leaveTo="/login" />
  ),
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByRole('heading', { name: 'Cancel the deletion?' })).toBeVisible()
    await expect(
      canvas.getByText(/This account is being deleted\. It is erased for good on .*2026/),
    ).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Leave it as it is' })).toHaveAttribute(
      'href',
      '/login',
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Cancel the deletion and keep using it' }),
    )
    await waitFor(() => expect(onCancelAsk).toHaveBeenCalledWith('restore-opaque'))
    // 토큰은 메모리에만 — 저장소 · 주소에 없다
    for (const store of [localStorage, sessionStorage])
      await expect(JSON.stringify({ ...store })).not.toContain('restore-opaque')
    await expect(location.href).not.toContain('restore-opaque')
  },
}
const onCancelAsk = fn(async () => undefined)

/** 한국어 문구 */
export const AskToCancelKorean: Story = {
  render: () => (
    <DeletionPendingScreen
      pending={pendingData}
      onCancel={async () => undefined}
      leaveTo="/login"
      labels={koAuthLabels}
      formatDate={() => '2026년 11월 5일'}
    />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: '탈퇴를 취소할까요?' })).toBeVisible()
    await expect(
      canvas.getByText('이 계정은 탈퇴 처리 중이에요. 2026년 11월 5일에 완전히 지워져요.'),
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: '탈퇴 취소하고 계속 쓰기' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: '그대로 두기' })).toBeVisible()
  },
}

/** 서버가 self-restore 를 꺼 둠 — 버튼 없이 안내만 */
export const NoRestoreToken: Story = {
  render: () => (
    <DeletionPendingScreen
      pending={{ purgeAfter: PURGE }}
      onCancel={fn()}
      leaveTo="/login"
      labels={koAuthLabels}
      formatDate={() => '2026년 11월 5일'}
    />
  ),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: '탈퇴 처리 중인 계정이에요' }),
    ).toBeVisible()
    await expect(
      canvas.getByText(
        '탈퇴 처리 중이라 로그인할 수 없어요. 2026년 11월 5일에 지워져요. 되돌리려면 문의해 주세요.',
      ),
    ).toBeVisible()
    await expect(canvas.queryByRole('button')).toBeNull()
    await expect(canvas.getByRole('link', { name: '로그인으로 돌아가기' })).toBeVisible()
  },
}

/** 취소하려는 사이 토큰이 만료됐다(410) — 다시 로그인하게 한다. 같은 토큰을 다시 내지 않는다 */
export const CancelExpired: Story = {
  render: () => (
    <DeletionPendingScreen
      pending={pendingData}
      onCancel={async () => {
        throw apiError('ACCOUNT.TOKEN_INVALID', 410)
      }}
      leaveTo="/login"
      labels={koAuthLabels}
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '탈퇴 취소하고 계속 쓰기' }))
    await expect(await canvas.findByRole('heading', { name: '시간이 지났어요' })).toBeVisible()
    await expect(canvas.getByText('시간이 지났어요. 다시 로그인해 주세요.')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '탈퇴 취소하고 계속 쓰기' })).toBeNull()
    await expect(canvas.getByRole('link', { name: '로그인으로 돌아가기' })).toHaveAttribute(
      'href',
      '/login',
    )
  },
}

/** 네트워크 오류 같은 일시 실패 — 문구를 보이고 같은 토큰으로 다시 누를 수 있다 */
export const CancelFailsThenWorks: Story = {
  render: () => {
    const calls = { n: 0 }
    return (
      <DeletionPendingScreen
        pending={pendingData}
        leaveTo="/login"
        onCancel={async () => {
          calls.n += 1
          if (calls.n === 1) throw apiError('CLIENT.NETWORK_ERROR', 0)
        }}
      />
    )
  },
  play: async ({ canvas, userEvent }) => {
    const cancel = await canvas.findByRole('button', {
      name: 'Cancel the deletion and keep using it',
    })
    await userEvent.click(cancel)
    await expect(await canvas.findByText('No connection. Try again.')).toBeVisible()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Cancel the deletion and keep using it' }),
    )
    await waitFor(() => expect(canvas.queryByText('No connection. Try again.')).toBeNull())
  },
}

/** 비밀번호 로그인 — 같은 화면에서 묻고, 「그대로 두기」는 빈 비밀번호의 로그인 양식으로 */
export const PasswordSignInPending: Story = {
  render: () => <PasswordHost />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Email/), 'ann@example.com')
    await userEvent.type(canvas.getByLabelText(/^Password/), 'secret-pass{Enter}')
    await expect(await canvas.findByRole('heading', { name: 'Cancel the deletion?' })).toBeVisible()
    await expect(canvas.queryByLabelText(/^Password/)).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Leave it as it is' }))
    await expect(await canvas.findByLabelText(/^Password/)).toHaveValue('')
    await expect(canvas.getByLabelText(/Email/)).toHaveValue('ann@example.com')
    // 다시 로그인하면 다시 묻고, 이번에는 취소한다
    await userEvent.type(canvas.getByLabelText(/^Password/), 'secret-pass{Enter}')
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Cancel the deletion and keep using it' }),
    )
    await waitFor(() => expect(hostCancel).toHaveBeenCalledWith('restore-opaque'))
  },
}
const hostCancel = fn(async () => undefined)
function PasswordHost() {
  return (
    <SignInScreen
      onPasswordSignIn={async () => {
        throw pendingError()
      }}
      onCancelDeletion={hostCancel}
    />
  )
}

/** 메일 링크 도착 화면 — 링크가 맞아도 세션 대신 같은 질문 */
export const MagicLinkPending: Story = {
  render: () => (
    <MagicLinkLanding
      token="tok"
      requestTo="/login"
      onDone={fn()}
      onRedeem={async () => {
        throw pendingError()
      }}
      onCancelDeletion={fn(async () => undefined)}
    />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'Cancel the deletion?' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Leave it as it is' })).toHaveAttribute(
      'href',
      '/login',
    )
  },
}

/** 소셜 콜백 — 실패가 아니라 같은 질문 */
export const SocialCallbackPending: Story = {
  render: () => (
    <SocialCallbackScreen
      state={{ status: 'error', error: pendingError() }}
      signInTo="/login"
      onCancelDeletion={fn(async () => undefined)}
    />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'Cancel the deletion?' })).toBeVisible()
    await expect(canvas.queryByText('Sign-in did not finish')).toBeNull()
  },
}

/** 서버가 토큰을 안 줌(self-restore 꺼짐) — 소셜 콜백에서도 안내만 */
export const SocialCallbackPendingWithoutToken: Story = {
  render: () => (
    <SocialCallbackScreen
      state={{ status: 'error', error: pendingError(null) }}
      signInTo="/login"
      onCancelDeletion={fn(async () => undefined)}
    />
  ),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'This account is being deleted' }),
    ).toBeVisible()
    await expect(canvas.queryByRole('button')).toBeNull()
  },
}

/** 삭제를 마친 직후 — 서버가 세션을 이미 닫았고 로컬 세션도 지웠다. 보호되지 않은 안내(머리글도 로그아웃 상태) */
export const AccountDeletedLanding: Story = {
  render: () => (
    <AccountDeletedScreen
      purgeAfter={PURGE}
      selfRestore
      signInTo="/login"
      labels={koAuthLabels}
      formatDate={() => '2026. 11. 5.'}
    />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: '탈퇴가 접수됐어요' })).toBeVisible()
    await expect(canvas.getByText(/2026\. 11\. 5\.에 지워져요/)).toBeVisible()
    await expect(canvas.getByText(/그 전에 다시 로그인하면 취소할 수 있어요/)).toBeVisible()
    await expect(canvas.getByRole('link', { name: '로그인 화면으로' })).toHaveAttribute(
      'href',
      '/login',
    )
  },
}
