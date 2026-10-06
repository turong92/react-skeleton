import { useCallback, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import type { AccountApi } from '../account/accountApi'
import type { AuthApi } from '../authApi'
import { postSignInTarget, rememberReturnTo, consumeReturnTo } from '../returnTo'
import { AccountSettings, type AccountSettingsProps } from '../screens/AccountSettings'
import { ConfirmEmailChangeLanding } from '../screens/ConfirmEmailChangeLanding'
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen'
import { MagicLinkLanding } from '../screens/MagicLinkLanding'
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen'
import { SignInScreen } from '../screens/SignInScreen'
import { SignUpScreen, type SignUpScreenProps } from '../screens/SignUpScreen'
import { SocialCallbackScreen } from '../screens/SocialCallbackScreen'
import { VerifyEmailScreen } from '../screens/VerifyEmailScreen'
import { readLinkToken } from '../screens/linkToken'
import type { AuthLabels } from '../screens/labels'
import type { SignInMethodsConfig } from '../screens/methods'
import { useResource } from '../screens/useResource'
import type { SocialLoginFlow } from '../social'
import type { SocialLinkFlow } from '../socialLink'
import { useAuth } from '../useAuth'
import { useMounted } from './useMounted'
import { useSocialLoginCallback } from '../useSocialLoginCallback'

export type AuthPaths = {
  signIn: string
  signUp: string
  forgotPassword: string
  resetPassword: string
  verifyEmail: string
  magicLink: string
  socialCallback: string
  socialLinkCallback: string
  confirmEmailChange: string
  account: string
  confirmDelete: string
}

function usePolicy(accountApi: AccountApi) {
  return useResource(
    useCallback(() => accountApi.passwordPolicy().catch(() => undefined), [accountApi]),
  ).data
}

export type PageContext = {
  authApi: AuthApi
  accountApi: AccountApi
  labels?: Partial<AuthLabels>
  paths: AuthPaths
  /** 로그인 뒤 기본 목적지 */
  afterSignIn: string
  methods?: SignInMethodsConfig
  socialFlow?: SocialLoginFlow
  socialLinkFlow?: SocialLinkFlow
}

function useTarget(afterSignIn: string) {
  const location = useLocation()
  return postSignInTarget(location.state, afterSignIn)
}

export function SignInPage({
  ctx,
  notice,
  deviceHint,
}: {
  ctx: PageContext
  notice?: string
  deviceHint?: undefined
}) {
  void deviceHint
  const auth = useAuth()
  const navigate = useNavigate()
  const target = useTarget(ctx.afterSignIn)
  if (auth.status === 'authenticated') return <Navigate to={target} replace />
  return (
    <SignInScreen
      labels={ctx.labels}
      methods={ctx.methods}
      notice={notice}
      signUpTo={ctx.paths.signUp}
      forgotPasswordTo={ctx.paths.forgotPassword}
      onPasswordSignIn={async (credentials) => {
        await auth.login(credentials)
        navigate(target, { replace: true })
      }}
      onMagicLinkRequest={(email) => ctx.authApi.magicLinkRequest(email)}
      onResendVerification={async (email) => {
        await ctx.accountApi.resendVerification(email)
      }}
      onSocialSignIn={(provider) => {
        if (!ctx.socialFlow) return
        rememberReturnTo(target)
        window.location.assign(ctx.socialFlow.start(provider).url)
      }}
    />
  )
}

export function SignUpPage({
  ctx,
  signUp,
}: {
  ctx: PageContext
  signUp: Partial<SignUpScreenProps>
}) {
  const policy = usePolicy(ctx.accountApi)
  const auth = useAuth()
  const navigate = useNavigate()
  if (auth.status === 'authenticated') return <Navigate to={ctx.afterSignIn} replace />
  return (
    <SignUpScreen
      {...signUp}
      policy={policy}
      labels={ctx.labels}
      methods={ctx.methods}
      signInTo={ctx.paths.signIn}
      onSignUp={async ({ consents, ...request }) => {
        void consents // 동의 모듈이 생기면 서버로 보낸다 — 지금은 `onConsentsChange` · `signUp.onSignUp` 훅이 받는다
        return ctx.accountApi.signUp(request)
      }}
      onResendVerification={(email) => ctx.accountApi.resendVerification(email)}
      onCreated={() => navigate(ctx.paths.signIn, { replace: true })}
      onSocialSignIn={(provider) => {
        if (!ctx.socialFlow) return
        window.location.assign(ctx.socialFlow.start(provider).url)
      }}
    />
  )
}

export function ForgotPage({ ctx }: { ctx: PageContext }) {
  return (
    <ForgotPasswordScreen
      labels={ctx.labels}
      signInTo={ctx.paths.signIn}
      onSubmit={(email) => ctx.accountApi.forgotPassword(email)}
    />
  )
}

function TokenPage({ children }: { children: (token: string | null) => ReactNode }) {
  const mounted = useMounted()
  const location = useLocation()
  if (!mounted) return null
  return children(readLinkToken(location))
}

export function ResetPage({ ctx }: { ctx: PageContext }) {
  const policy = usePolicy(ctx.accountApi)
  return (
    <TokenPage>
      {(token) => (
        <ResetPasswordScreen
          token={token}
          policy={policy}
          labels={ctx.labels}
          signInTo={ctx.paths.signIn}
          forgotTo={ctx.paths.forgotPassword}
          onReset={(t, newPassword) => ctx.accountApi.resetPassword(t, newPassword)}
        />
      )}
    </TokenPage>
  )
}

export function VerifyPage({ ctx }: { ctx: PageContext }) {
  return (
    <TokenPage>
      {(token) => (
        <VerifyEmailScreen
          token={token}
          labels={ctx.labels}
          signInTo={ctx.paths.signIn}
          onVerify={(t) => ctx.accountApi.verifyEmail(t)}
          onResend={(email) => ctx.accountApi.resendVerification(email)}
        />
      )}
    </TokenPage>
  )
}

export function MagicLinkPage({ ctx }: { ctx: PageContext }) {
  const auth = useAuth()
  const navigate = useNavigate()
  return (
    <TokenPage>
      {(token) => (
        <MagicLinkLanding
          token={token}
          labels={ctx.labels}
          requestTo={ctx.paths.signIn}
          onRedeem={(t) => auth.magicLinkLogin(t)}
          onDone={() => navigate(ctx.afterSignIn, { replace: true })}
        />
      )}
    </TokenPage>
  )
}

export function ConfirmEmailChangePage({ ctx }: { ctx: PageContext }) {
  const auth = useAuth()
  return (
    <TokenPage>
      {(token) => (
        <ConfirmEmailChangeLanding
          token={token}
          labels={ctx.labels}
          signInTo={ctx.paths.signIn}
          onConfirm={async (t) => {
            await ctx.accountApi.confirmEmailChange(t)
            // 서버가 모든 세션을 닫는다 — 이 기기도 로그아웃으로 다루고 로그인으로 보낸다
            await auth.logout()
          }}
        />
      )}
    </TokenPage>
  )
}

function SocialCallbackInner({ flow, ctx }: { flow: SocialLoginFlow; ctx: PageContext }) {
  const location = useLocation()
  const navigate = useNavigate()
  const state = useSocialLoginCallback(flow, location.search)
  if (state.status === 'success') {
    navigate(consumeReturnTo(ctx.afterSignIn), { replace: true })
    return null
  }
  return <SocialCallbackScreen state={state} labels={ctx.labels} signInTo={ctx.paths.signIn} />
}

export function SocialCallbackPage({ ctx }: { ctx: PageContext }) {
  const mounted = useMounted()
  if (!mounted || !ctx.socialFlow) return null
  return <SocialCallbackInner flow={ctx.socialFlow} ctx={ctx} />
}

export function SocialLinkCallbackPage({ ctx }: { ctx: PageContext }) {
  const mounted = useMounted()
  const location = useLocation()
  const navigate = useNavigate()
  const flow = ctx.socialLinkFlow
  const search = location.search
  const state = useResource(
    useCallback(
      () => (flow ? flow.complete(search).then(() => true) : Promise.resolve(false)),
      [flow, search],
    ),
  )
  if (!mounted || !flow) return null
  if (state.data) return <Navigate to={ctx.paths.account} replace />
  void navigate
  return (
    <SocialCallbackScreen
      state={state.error ? { status: 'error', error: state.error } : { status: 'pending' }}
      labels={ctx.labels}
      signInTo={ctx.paths.account}
    />
  )
}

export type SettingsExtras = Partial<
  Pick<AccountSettingsProps, 'sections' | 'graceDays' | 'supportHref' | 'formatDate' | 'timeZones'>
> & { locales: AccountSettingsProps['locales'] }

export function AccountPage({
  ctx,
  settings,
  confirmDelete,
  socialProviders,
}: {
  ctx: PageContext
  settings: SettingsExtras
  confirmDelete?: boolean
  socialProviders?: AccountSettingsProps['socialProviders']
}) {
  const auth = useAuth()
  const location = useLocation()
  const mounted = useMounted()
  if (!mounted) return null
  return (
    <AccountSettings
      api={ctx.accountApi}
      labels={ctx.labels}
      socialProviders={socialProviders}
      onLinkSocial={(provider) => {
        if (!ctx.socialLinkFlow) return
        window.location.assign(ctx.socialLinkFlow.start(provider).url)
      }}
      confirmationToken={confirmDelete ? (readLinkToken(location) ?? undefined) : undefined}
      onDeleted={() => void auth.logout()}
      {...settings}
    />
  )
}

/** 렌더 때 `useLabels` · `useApis` 훅으로 문구 · API 를 골라 페이지에 넘긴다(언어를 바꾸면 그 자리에서 다시 그린다) */
export function WithLabels({
  ctx,
  useLabels,
  useApis,
  render,
}: {
  ctx: PageContext
  useLabels?: () => Partial<AuthLabels> | undefined
  useApis?: () => { authApi: AuthApi; accountApi: AccountApi }
  render: (ctx: PageContext) => ReactNode
}) {
  const labels = useLabels?.() ?? ctx.labels
  const apis = useApis?.()
  return render({ ...ctx, ...apis, labels })
}
