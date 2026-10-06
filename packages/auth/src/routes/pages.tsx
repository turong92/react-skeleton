import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import {
  useDiscoveredContext,
  type DiscoveredState,
  type DiscoveryNotes,
  type DiscoveryOptions,
} from './discovery'
import type { ReauthChannel } from '../reauthChannel'
import type { AuthStorageKeys } from '../storageKeys'
import { scrubUrlParams } from '../scrubUrl'
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
  /** 본인 확인 토큰을 같은 브라우저의 다른 탭에 넘기는 채널 — 앱이 만들어 넘긴다(없으면 토큰은 이 탭에 보관) */
  reauthChannel?: ReauthChannel | null
  /** 저장 키 · 락 · 채널 이름(앱 이름공간) */
  keys: AuthStorageKeys
  /** 이 라우트 한 벌의 기억(경고를 한 번만 하기 등) */
  notes: DiscoveryNotes
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
        rememberReturnTo(target, undefined, ctx.keys.returnTo)
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
  // 읽은 토큰은 화면의 메모리에 있다 — 주소창 · 히스토리에서는 지운다(되돌릴 수 없는 일회용 값이 어깨너머로 · 뒤로 가기로 새지 않게)
  useEffect(() => {
    if (mounted) scrubUrlParams(['token'])
  }, [mounted])
  if (!mounted) return null
  return children(readLinkToken(location))
}

/** 현재 로그인한 계정에 묶인 다시 인증 보관소 — 다른 계정이 적은 하려던 작업 · 토큰은 읽히지 않는다 */
function useBoundReauth(store: ReauthStore): ReauthStore {
  const accountId = useAuth().principal?.accountId ?? null
  return useMemo(() => store.forAccount(accountId), [store, accountId])
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
            // 서버는 그 계정의 모든 세션을 닫는다. 이 기기에 로그인한 사람이 **그 계정인지는 모른다** — 무조건 로그아웃하지 않고
            // 한 번 물어본다: 그 계정이면 401 → 갱신 실패로 세션이 정리되고, 다른 계정이면 그대로 남는다
            await auth.refresh().catch(() => undefined)
          }}
        />
      )}
    </TokenPage>
  )
}

export function ConfirmReauthPage({ ctx }: { ctx: PageContext }) {
  const reauth = useBoundReauth(ctx.reauth)
  const channel = ctx.reauthChannel
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
              store: reauth,
              accountApi: ctx.accountApi,
              channel,
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
  const navigated = useRef(false)
  // 쓰인(또는 거절된) 인가 코드는 주소창에 남기지 않는다
  useEffect(() => {
    scrubUrlParams(['code', 'state', 'error', 'error_description'])
  }, [])
  // 이동과 「가려던 곳」 읽기(읽으면 지워진다)는 렌더가 아니라 효과에서, 한 번만 — StrictMode 가 두 번 돌려도 가려던 곳이 사라지지 않는다
  useEffect(() => {
    if (state.status !== 'success' || navigated.current) return
    navigated.current = true
    navigate(consumeReturnTo(ctx.afterSignIn, undefined, ctx.keys.returnTo), { replace: true })
  }, [state.status, navigate, ctx.afterSignIn, ctx.keys.returnTo])
  if (state.status === 'success') return null
  return <SocialCallbackScreen state={state} labels={ctx.labels} signInTo={ctx.paths.signIn} />
}

/** 소셜 흐름이 없는 콜백 — 방법을 아직 묻는 중이면 기다리고, 묻기에 실패했거나 그 제공자가 없으면 오류 화면(다시 시도 포함). 쓰이지 않은 코드는 주소에서 지운다 */
function SocialCallbackUnavailable({
  ctx,
  signInTo,
}: {
  ctx: PageContext
  signInTo: string
}) {
  useEffect(() => {
    scrubUrlParams(['code', 'state', 'error', 'error_description'])
  }, [])
  const failed = ctx.discovered?.status === 'failed'
  return (
    <SocialCallbackScreen
      state={{ status: 'error', error: new Error('social login is not available') }}
      labels={ctx.labels}
      signInTo={signInTo}
      onRetry={failed ? ctx.discovered?.retry : undefined}
    />
  )
}

export function SocialCallbackPage({ ctx }: { ctx: PageContext }) {
  const mounted = useMounted()
  if (!mounted) return null
  if (ctx.socialFlow) return <SocialCallbackInner flow={ctx.socialFlow} ctx={ctx} />
  if (ctx.discovered?.status === 'loading')
    return (
      <SocialCallbackScreen
        state={{ status: 'pending' }}
        labels={ctx.labels}
        signInTo={ctx.paths.signIn}
      />
    )
  return <SocialCallbackUnavailable ctx={ctx} signInTo={ctx.paths.signIn} />
}

function SocialLinkCallbackInner({ flow, ctx }: { flow: SocialLinkFlow; ctx: PageContext }) {
  const location = useLocation()
  const reauth = useBoundReauth(ctx.reauth)
  useEffect(() => {
    scrubUrlParams(['code', 'state', 'error', 'error_description'])
  }, [])
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
    // 지우지 않고 본다 — 호출이 성공한 뒤에만 지워, 일시 오류에 토큰을 잃지 않는다
    const token = reauth.peekToken()
    ctx.accountApi
      .linkSocial(
        callback.provider,
        callback.authorizationCode,
        callback.redirectUri,
        token ? { confirmationToken: token } : undefined,
      )
      .then(() => {
        if (token) reauth.clearToken()
        setDone(true)
      }, setFailure)
  }, [callback, account, ctx.accountApi, reauth])

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
  if (!mounted) return null
  if (ctx.socialLinkFlow) return <SocialLinkCallbackInner flow={ctx.socialLinkFlow} ctx={ctx} />
  if (ctx.discovered?.status === 'loading')
    return (
      <SocialCallbackScreen
        state={{ status: 'pending' }}
        labels={ctx.labels}
        signInTo={ctx.paths.account}
      />
    )
  return <SocialCallbackUnavailable ctx={ctx} signInTo={ctx.paths.account} />
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
  const reauth = useBoundReauth(ctx.reauth)
  useEffect(() => {
    if (mounted && confirmDelete) scrubUrlParams(['token'])
  }, [mounted, confirmDelete])
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
      reauth={reauth}
      reauthChannel={ctx.reauthChannel}
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
    notes: ctx.notes,
    statePrefixes: { social: ctx.keys.social, socialLink: ctx.keys.socialLink },
  })
  return render({ ...ctx, ...apis, ...discovered, labels })
}
