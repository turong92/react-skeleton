import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button } from '@skeleton/ui'
import { AuthLayout } from '../screens/AuthLayout'
import type { AccountApi } from '../account/accountApi'
import type { AuthApi } from '../authApi'
import { postSignInTarget, rememberReturnTo, consumeReturnTo } from '../returnTo'
import { AccountSettings, type AccountSettingsProps } from '../screens/AccountSettings'
import { ConfirmEmailChangeLanding } from '../screens/ConfirmEmailChangeLanding'
import { ConfirmReauthLanding } from '../screens/ConfirmReauthLanding'
import { resolveReauthLanding } from '../reauthLanding'
import type { ReauthStore } from '../reauth'
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen'
import { MagicLinkLanding } from '../screens/MagicLinkLanding'
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen'
import { SignInScreen } from '../screens/SignInScreen'
import { SignUpScreen, type SignUpScreenProps } from '../screens/SignUpScreen'
import { SocialCallbackScreen } from '../screens/SocialCallbackScreen'
import { SocialLinkPasswordScreen } from '../screens/SocialLinkPasswordScreen'
import { labelOfMethod } from '../screens/methodsList'
import { VerifyEmailScreen } from '../screens/VerifyEmailScreen'
import { readLinkToken } from '../screens/linkToken'
import { mergeLabels, type AuthLabels } from '../screens/labels'
import { resolveMethods, type SignInMethodsConfig } from '../screens/methods'
import { useResource } from '../screens/useResource'
import type { SocialLoginFlow } from '../social'
import type { SocialLinkFlow } from '../socialLink'
import { useAuth } from '../useAuth'
import { useMounted } from './useMounted'
import styles from '../screens/auth.module.css'
import { DiscoveryLoading } from '../screens/DiscoveryLoading'
import { useDiscoveredContext, type DiscoveredState, type DiscoveryOptions } from './discovery'
import { browserReauthChannel } from '../reauthChannel'
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
  confirmReauth: string
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
  /** 비밀번호 없는 계정의 다시 인증 — 하려던 작업과 받은 토큰을 기억한다 */
  reauth: ReauthStore
  /** 백엔드에 로그인 방법을 묻는 앱의 설정(없으면 `methods` 가 정한다) */
  discovery?: DiscoveryOptions
  /** 발견의 현재 상태 — 화면이 로딩 · 실패를 그린다(렌더 때 채워진다) */
  discovered?: DiscoveredState
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
  if (ctx.discovered?.status === 'loading') return <DiscoveryLoading labels={ctx.labels} />
  const failed = ctx.discovered?.status === 'failed'
  const labels = mergeLabels(ctx.labels)
  return (
    <SignInScreen
      labels={ctx.labels}
      methods={ctx.methods}
      notice={failed ? labels.methodsFailed : notice}
      noticeAction={
        failed ? (
          <Button variant="secondary" size="sm" onClick={ctx.discovered?.retry}>
            {labels.methodsRetry}
          </Button>
        ) : undefined
      }
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
  if (ctx.discovered?.status === 'loading')
    return <DiscoveryLoading title={mergeLabels(ctx.labels).signUpTitle} labels={ctx.labels} />
  if (ctx.discovered?.status === 'ready' && !ctx.discovered.signUp) {
    const labels = mergeLabels(ctx.labels)
    return (
      <AuthLayout title={labels.signUpClosedTitle}>
        <div className={styles.stack}>
          <Alert tone="warning">{labels.errorSignUpClosed}</Alert>
          <Link className={styles.link} to={ctx.paths.signIn}>
            {labels.signInTitle}
          </Link>
        </div>
      </AuthLayout>
    )
  }
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

export function ConfirmReauthPage({ ctx }: { ctx: PageContext }) {
  return (
    <TokenPage>
      {(token) => (
        <ConfirmReauthLanding
          token={token}
          labels={ctx.labels}
          settingsTo={ctx.paths.account}
          onResolve={(t) =>
            resolveReauthLanding({
              token: t,
              store: ctx.reauth,
              accountApi: ctx.accountApi,
              channel: browserReauthChannel(),
            })
          }
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
  if (mounted && !ctx.socialFlow && ctx.discovered?.status === 'loading')
    return (
      <SocialCallbackScreen
        state={{ status: 'pending' }}
        labels={ctx.labels}
        signInTo={ctx.paths.signIn}
      />
    )
  if (!mounted || !ctx.socialFlow) return null
  return <SocialCallbackInner flow={ctx.socialFlow} ctx={ctx} />
}

function SocialLinkCallbackInner({ flow, ctx }: { flow: SocialLinkFlow; ctx: PageContext }) {
  const location = useLocation()
  const search = location.search
  const read = useResource(useCallback(() => flow.read(search), [flow, search]))
  const me = useResource(useCallback(() => ctx.accountApi.me(), [ctx.accountApi]))
  const [done, setDone] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  const started = useRef(false)
  const callback = read.data
  const account = me.data

  // 비밀번호 없는 계정: 링크를 열어 보관한 본인 확인 토큰으로 바로 마친다(서버는 토큰 없이는 403 `ACCOUNT.REAUTH_REQUIRED`)
  useEffect(() => {
    if (!callback || !account || account.hasPassword || started.current) return
    started.current = true
    const token = ctx.reauth.takeToken()
    ctx.accountApi
      .linkSocial(
        callback.provider,
        callback.authorizationCode,
        callback.redirectUri,
        token ? { confirmationToken: token } : undefined,
      )
      .then(() => setDone(true), setFailure)
  }, [callback, account, ctx.accountApi, ctx.reauth])

  if (done)
    return <Navigate to={ctx.paths.account} replace state={{ linked: callback?.provider }} />
  const error = read.error ?? me.error ?? failure
  if (error)
    return (
      <SocialCallbackScreen
        state={{ status: 'error', error }}
        labels={ctx.labels}
        signInTo={ctx.paths.account}
      />
    )
  // 비밀번호가 있는 계정: 제공자에 다녀온 뒤 현재 비밀번호를 받는다(코드는 이 화면이 쥐고 있다 — 틀려도 다시 시도할 수 있다)
  if (callback && account?.hasPassword)
    return (
      <SocialLinkPasswordScreen
        provider={labelOfMethod(callback.provider, mergeLabels(ctx.labels))}
        labels={ctx.labels}
        backTo={ctx.paths.account}
        onSubmit={async (currentPassword) => {
          await ctx.accountApi.linkSocial(
            callback.provider,
            callback.authorizationCode,
            callback.redirectUri,
            { currentPassword },
          )
          setDone(true)
        }}
      />
    )
  return (
    <SocialCallbackScreen
      state={{ status: 'pending' }}
      labels={ctx.labels}
      signInTo={ctx.paths.account}
    />
  )
}

export function SocialLinkCallbackPage({ ctx }: { ctx: PageContext }) {
  const mounted = useMounted()
  if (mounted && !ctx.socialLinkFlow && ctx.discovered?.status === 'loading')
    return (
      <SocialCallbackScreen
        state={{ status: 'pending' }}
        labels={ctx.labels}
        signInTo={ctx.paths.account}
      />
    )
  if (!mounted || !ctx.socialLinkFlow) return null
  return <SocialLinkCallbackInner flow={ctx.socialLinkFlow} ctx={ctx} />
}

export type SettingsExtras = Partial<
  Pick<AccountSettingsProps, 'sections' | 'graceDays' | 'supportHref' | 'formatDate' | 'timeZones'>
> & { locales: AccountSettingsProps['locales'] }

export function AccountPage({
  ctx,
  settings,
  confirmDelete,
}: {
  ctx: PageContext
  settings: SettingsExtras
  confirmDelete?: boolean
}) {
  const auth = useAuth()
  const location = useLocation()
  const mounted = useMounted()
  if (!mounted) return null
  return (
    <AccountSettings
      api={ctx.accountApi}
      labels={ctx.labels}
      socialProviders={resolveMethods(ctx.methods).social}
      onLinkSocial={(provider) => {
        if (!ctx.socialLinkFlow) return
        window.location.assign(ctx.socialLinkFlow.start(provider).url)
      }}
      confirmationToken={confirmDelete ? (readLinkToken(location) ?? undefined) : undefined}
      onDeleted={() => void auth.logout()}
      reauth={ctx.reauth}
      reauthChannel={browserReauthChannel()}
      linkedProvider={(location.state as { linked?: string } | null)?.linked}
      {...settings}
    />
  )
}

/** 렌더 때 `useLabels` · `useApis` 훅으로 문구 · API 를 골라 페이지에 넘긴다(언어를 바꾸면 그 자리에서 다시 그린다). 발견을 켠 라우트는 백엔드가 말해 준 로그인 방법을 채운다 */
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
  const discovered = useDiscoveredContext({
    discovery: ctx.discovery,
    authApi: apis?.authApi ?? ctx.authApi,
    accountApi: apis?.accountApi ?? ctx.accountApi,
    paths: ctx.paths,
  })
  return render({ ...ctx, ...apis, ...discovered, labels })
}
