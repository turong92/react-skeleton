import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button } from '@skeleton/ui'
import { AuthLayout } from '../screens/AuthLayout'
import type { AccountApi } from '../account/accountApi'
import type { AuthApi } from '../authApi'
import { postSignInTarget, rememberReturnTo, consumeReturnTo } from '../returnTo'
import { AccountSettings, type AccountSettingsProps } from '../screens/AccountSettings'
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen'
import { MagicLinkLanding } from '../screens/MagicLinkLanding'
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen'
import { SignInScreen } from '../screens/SignInScreen'
import { SignUpScreen, type SignUpScreenProps } from '../screens/SignUpScreen'
import { LegacyLinkNotice } from '../screens/LegacyLinkNotice'
import { AccountDeletedScreen } from '../screens/AccountDeletedScreen'
import { SocialLinkProofScreen } from '../screens/SocialLinkProofScreen'
import { reauthKindOf, reauthSubjectOf } from '../reauth/kind'
import { SocialCallbackScreen } from '../screens/SocialCallbackScreen'
import { authErrorMessage } from '../screens/errors'
import { labelOfMethod } from '../screens/methodsList'
import { readLinkToken } from '../screens/linkToken'
import { mergeLabels, type AuthLabels } from '../screens/labels'
import { resolveMethods, type SignInMethodsConfig } from '../screens/methods'
import { useResource } from '../screens/useResource'
import type { SocialLoginFlow } from '../social'
import type { SocialProof } from '../types'
import type { ProviderAction, SocialLinkFlow } from '../socialLink'
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
import type { AuthStorageKeys } from '../storageKeys'
import { scrubUrlParams } from '../scrubUrl'
import { CodeClockProvider } from '../codeClock'
import type { SignUpPendingStore } from '../signUpPending'
import { runOnce } from '../screens/runOnce'
import { useSocialLoginCallback } from '../useSocialLoginCallback'

export type AuthPaths = {
  signIn: string
  signUp: string
  forgotPassword: string
  resetPassword: string
  magicLink: string
  socialCallback: string
  socialLinkCallback: string
  account: string
  /** 삭제를 마친 직후의 안내(로그아웃 상태) */
  accountDeleted: string
}

/** 콜백이 돌려준 그 시도의 PKCE verifier · nonce — 제공자가 쓴 것만(없으면 undefined: 서버로 아무것도 더 보내지 않는다) */
function proofOf(callback: SocialProof): SocialProof | undefined {
  const proof: SocialProof = {
    ...(callback.codeVerifier ? { codeVerifier: callback.codeVerifier } : {}),
    ...(callback.nonce ? { nonce: callback.nonce } : {}),
  }
  return Object.keys(proof).length > 0 ? proof : undefined
}

/** `proof` 가 있을 때만 다섯 번째 인자로 보낸다 — PKCE 를 쓰지 않는 제공자의 호출은 이전과 똑같다 */
function linkSocial(
  api: AccountApi,
  provider: string,
  code: string,
  redirectUri: string | undefined,
  reauth: Parameters<AccountApi['linkSocial']>[3],
  proof: SocialProof | undefined,
) {
  return proof
    ? api.linkSocial(provider, code, redirectUri, reauth, proof)
    : api.linkSocial(provider, code, redirectUri, reauth)
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
  /** 인증번호 남은 시간을 세는 시계(서버 보정) */
  now?: () => number
  /** 날짜 표기(탈퇴 예정일 …) — 앱의 로케일 · 시간대 규칙. 없으면 브라우저 로케일 */
  formatDate?: (iso: string) => string
  paths: AuthPaths
  /** 로그인 뒤 기본 목적지 */
  afterSignIn: string
  methods?: SignInMethodsConfig
  socialFlow?: SocialLoginFlow
  socialLinkFlow?: SocialLinkFlow
  /** 백엔드에 로그인 방법을 묻는 앱의 설정(없으면 `methods` 가 정한다) */
  discovery?: DiscoveryOptions
  /** 새 비밀번호를 한 번 더 입력받는가(가입 · 재설정 · 변경 · 첫 설정) — 기본 true */
  confirmPassword?: boolean
  /** 진행 중인 가입 시도(코드 입력 단계가 새로고침을 견딘다) */
  signUpPending?: SignUpPendingStore
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
      formatDate={ctx.formatDate}
      onCancelDeletion={async (restoreToken) => {
        // 일반 로그인과 같은 처리 — 세션을 저장하고 가려던 곳으로(약관 재동의 등은 그 뒤 첫 호출의 가드가 이어 받는다)
        await auth.cancelDeletion(restoreToken)
        navigate(target, { replace: true })
      }}
      onSocialSignIn={async (provider) => {
        if (!ctx.socialFlow) return
        // 시작하지 못하면(WebCrypto 없음) 던진다 — 화면이 문구로 바꾸고, 「가려던 곳」은 아직 기억하지 않는다
        const { url } = await ctx.socialFlow.start(provider)
        rememberReturnTo(target, undefined, ctx.keys.returnTo)
        window.location.assign(url)
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
      confirmPassword={ctx.confirmPassword}
      {...signUp}
      policy={policy}
      labels={ctx.labels}
      methods={ctx.methods}
      signInTo={ctx.paths.signIn}
      initialPending={ctx.signUpPending?.read() ?? undefined}
      onPendingChange={(next) =>
        next ? ctx.signUpPending?.save(next) : ctx.signUpPending?.clear()
      }
      onVerifyCode={async (signUpId, code, options) => {
        // 인증이 끝나면 가입도 끝나고 바로 로그인한다(토큰 응답) — 이어서 원래 가려던 곳으로
        auth.signIn(await ctx.accountApi.verifySignUpCode(signUpId, code, options))
        navigate(ctx.afterSignIn, { replace: true })
      }}
      onResendCode={(signUpId) => ctx.accountApi.resendSignUpCode(signUpId)}
      onSignUp={async ({ consents, ...request }) =>
        // 체크한 약관 · 방침은 가입 시도에 묶여 간다(백엔드 legal 모듈 — 없으면 서버가 무시한다). 하나도 없으면 필드를 싣지 않는다
        ctx.accountApi.signUp({
          ...request,
          ...(consents.length > 0
            ? {
                consents: consents.map((c) => ({
                  type: c.id,
                  version: c.version,
                  ...(c.locale ? { locale: c.locale } : {}),
                })),
              }
            : {}),
        })
      }
      onCreated={() => navigate(ctx.paths.signIn, { replace: true })}
      onSocialSignIn={async (provider) => {
        if (!ctx.socialFlow) return
        window.location.assign((await ctx.socialFlow.start(provider)).url)
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
          confirmPassword={ctx.confirmPassword}
          onReset={(t, newPassword) => ctx.accountApi.resetPassword(t, newPassword)}
        />
      )}
    </TokenPage>
  )
}

export function LegacyLinkPage({ ctx }: { ctx: PageContext }) {
  return <LegacyLinkNotice labels={ctx.labels} signInTo={ctx.paths.signIn} />
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
          formatDate={ctx.formatDate}
          onCancelDeletion={async (restoreToken) => {
            await auth.cancelDeletion(restoreToken)
            navigate(ctx.afterSignIn, { replace: true })
          }}
        />
      )}
    </TokenPage>
  )
}

function SocialCallbackInner({ flow, ctx }: { flow: SocialLoginFlow; ctx: PageContext }) {
  const location = useLocation()
  const navigate = useNavigate()
  const auth = useAuth()
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
  return (
    <SocialCallbackScreen
      state={state}
      labels={ctx.labels}
      signInTo={ctx.paths.signIn}
      formatDate={ctx.formatDate}
      onCancelDeletion={async (restoreToken) => {
        // 탈퇴 대기 계정의 소셜 로그인 — 취소하면 일반 로그인 성공과 같은 이동(가려던 곳을 읽고 지운다)
        await auth.cancelDeletion(restoreToken)
        navigated.current = true
        navigate(consumeReturnTo(ctx.afterSignIn, undefined, ctx.keys.returnTo), { replace: true })
      }}
    />
  )
}

/** 소셜 흐름이 없는 콜백 — 방법을 아직 묻는 중이면 기다리고, 묻기에 실패했거나 그 제공자가 없으면 오류 화면(다시 시도 포함). 쓰이지 않은 코드는 주소에서 지운다 */
function SocialCallbackUnavailable({ ctx, signInTo }: { ctx: PageContext; signInTo: string }) {
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
  const auth = useAuth()
  const location = useLocation()
  if (!mounted) return null
  // 로그인이 끝난 뒤 뒤로 가기 · 즐겨찾기로 쿼리 없는 콜백 주소에 왔다 — 오류 화면 대신 가던 길로
  if (auth.status === 'authenticated' && !location.search)
    return <Navigate to={ctx.afterSignIn} replace />
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
  const auth = useAuth()
  const accountId = auth.principal?.accountId ?? null
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
  const action = useMemo<ProviderAction | null>(
    () => (callback ? (callback.context?.action ?? { kind: 'link' }) : null),
    [callback],
  )
  // state 는 시작한 계정에 묶여 있다 — 같은 탭에서 계정이 바뀌었으면(다른 사람이 시작한 왕복) 이어 가지 않는다
  const foreign = !!callback?.context && callback.context.accountId !== accountId
  const reauthProviders = resolveMethods(ctx.methods).social.map((p) => p.provider)

  // 연결할 제공자의 코드를 쥐고 이미 연결된 제공자로 다시 인증하고 돌아왔다 — 두 코드로 한 번에 연결한다(한 번만: StrictMode 의 두 번째 효과가 코드를 또 쓰지 않게)
  useEffect(() => {
    if (!callback || foreign || action?.kind !== 'link-reauth' || started.current) return
    started.current = true
    const { target } = action
    // 두 인가 코드는 한 번씩만 쓸 수 있다 — 화면이 다시 마운트돼 `started` 가 새것이어도 같은 코드 쌍은 한 번만 보낸다
    void runOnce(`link-reauth:${target.authorizationCode}:${callback.authorizationCode}`, () =>
      linkSocial(
        ctx.accountApi,
        target.provider,
        target.authorizationCode,
        target.redirectUri,
        {
          socialReauth: {
            provider: callback.provider,
            authorizationCode: callback.authorizationCode,
            redirectUri: callback.redirectUri,
            ...proofOf(callback),
          },
        },
        proofOf(target),
      ),
    ).then(() => setDone(true), setFailure)
  }, [callback, foreign, action, ctx.accountApi])

  if (done)
    return (
      <Navigate
        to={ctx.paths.account}
        replace
        state={{
          linked: action?.kind === 'link-reauth' ? action.target.provider : callback?.provider,
        }}
      />
    )
  const error = read.error ?? me.error ?? failure
  if (error)
    return (
      <SocialCallbackScreen
        state={{ status: 'error', error }}
        labels={ctx.labels}
        signInTo={ctx.paths.account}
      />
    )
  if (callback && foreign)
    return (
      <SocialCallbackScreen
        state={{ status: 'error', error: new Error('this round trip belongs to another account') }}
        labels={ctx.labels}
        signInTo={ctx.paths.account}
      />
    )
  // 이메일 변경 · 연결 해제 · 삭제의 다시 인증 — 새 인가 코드를 가지고 설정 화면으로 돌아가 하려던 작업을 이어서 한다
  if (callback && action && ['email-change', 'unlink', 'delete'].includes(action.kind))
    return (
      <Navigate
        to={ctx.paths.account}
        replace
        state={{
          resume: {
            action,
            socialReauth: {
              provider: callback.provider,
              authorizationCode: callback.authorizationCode,
              ...(callback.redirectUri ? { redirectUri: callback.redirectUri } : {}),
              ...proofOf(callback),
            },
          },
        }}
      />
    )
  // 제공자를 연결한다 — 계정에 맞는 증거(비밀번호 · 메일 인증번호 · 다른 제공자의 동의)를 받는다. 코드는 이 화면이 쥐고 있어 틀려도 다시 시도할 수 있다
  if (callback && account && action?.kind === 'link') {
    const subject = reauthSubjectOf(account)
    return (
      <SocialLinkProofScreen
        provider={labelOfMethod(callback.provider, mergeLabels(ctx.labels))}
        kind={reauthKindOf(subject)}
        email={subject.email}
        reauthProviders={subject.providers.filter((p) => reauthProviders.includes(p))}
        labels={ctx.labels}
        backTo={ctx.paths.account}
        requestCode={() => ctx.accountApi.requestReauthConfirmation()}
        onSubmit={async (credential) => {
          await linkSocial(
            ctx.accountApi,
            callback.provider,
            callback.authorizationCode,
            callback.redirectUri,
            credential,
            proofOf(callback),
          )
          setDone(true)
        }}
        onProvider={async (reauthProvider) => {
          if (!accountId) return
          // 연결하려던 제공자의 코드(와 그 시도의 verifier · nonce)는 state 에 묶어 두고 이미 연결된 제공자의 동의를 거친다
          const { url } = await flow.start(reauthProvider, {
            accountId,
            action: {
              kind: 'link-reauth',
              target: {
                provider: callback.provider,
                authorizationCode: callback.authorizationCode,
                ...(callback.redirectUri ? { redirectUri: callback.redirectUri } : {}),
                ...proofOf(callback),
              },
            },
          })
          window.location.assign(url)
        }}
      />
    )
  }
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
  Pick<
    AccountSettingsProps,
    'sections' | 'graceDays' | 'selfRestore' | 'supportHref' | 'formatDate' | 'timeZones'
  >
> & {
  locales: AccountSettingsProps['locales']
  /** 설정 화면 아래에 이어 붙일 것(예: `@skeleton/legal` 의 `<ConsentSettings />`) */
  after?: ReactNode
}

type AccountRouteState = {
  linked?: string
  resume?: AccountSettingsProps['resume']
} | null

/** 삭제를 마친 직후 — 서버는 세션을 이미 닫았다. 이 기기의 로컬 세션도 여기서 지운다(머리글이 로그아웃 상태가 되게). 보호되지 않은 화면이다 */
export function AccountDeletedPage({
  ctx,
  settings,
}: {
  ctx: PageContext
  settings: SettingsExtras
}) {
  const auth = useAuth()
  const location = useLocation()
  const { logout } = auth
  const purgeAfter = (location.state as { purgeAfter?: string } | null)?.purgeAfter
  useEffect(() => {
    void logout()
  }, [logout])
  return (
    <AccountDeletedScreen
      purgeAfter={purgeAfter}
      selfRestore={settings.selfRestore}
      signInTo={ctx.paths.signIn}
      formatDate={ctx.formatDate ?? settings.formatDate}
      labels={ctx.labels}
    />
  )
}

export function AccountPage({
  ctx,
  settings: given,
}: {
  ctx: PageContext
  settings: SettingsExtras
}) {
  const { after, ...settings } = given
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const mounted = useMounted()
  const accountId = auth.principal?.accountId ?? null
  const state = location.state as AccountRouteState
  // 제공자 동의에서 돌아오며 실어 온 증거 — 한 번 쥐고 주소의 state 에서는 곧 지운다(새로고침 · 뒤로 가기에 인가 코드가 남지 않게)
  const [resume] = useState(() => state?.resume ?? null)
  const flow = ctx.socialLinkFlow
  const [startError, setStartError] = useState<string | null>(null)
  const beginRoundTrip = async (provider: string, action: ProviderAction) => {
    if (!flow || !accountId) return
    setStartError(null)
    try {
      const { url } = await flow.start(provider, { accountId, action })
      window.location.assign(url)
    } catch (error) {
      setStartError(authErrorMessage(error, mergeLabels(ctx.labels)).message)
    }
  }
  // 삭제가 받아들여지면 바로 로그아웃 상태의 안내 화면으로 — 서버는 이미 모든 세션을 닫았다(이 화면에 남으면 로그인된 것처럼 보인다).
  // `api` 의 정체성이 바뀌면 설정 화면이 프로필을 다시 읽는다(죽은 토큰으로 401) — 그래서 `navigate` 는 ref 로 쥐고 `api` 는 안정적으로 둔다
  const navigateRef = useRef(navigate)
  useEffect(() => {
    navigateRef.current = navigate
  })
  const deletedPath = ctx.paths.accountDeleted
  const api = useMemo(
    () => ({
      ...ctx.accountApi,
      deleteAccount: async (credential: Parameters<AccountApi['deleteAccount']>[0]) => {
        const result = await ctx.accountApi.deleteAccount(credential)
        navigateRef.current(deletedPath, {
          replace: true,
          state: { purgeAfter: result.purgeAfter },
        })
        return result
      },
    }),
    [ctx.accountApi, deletedPath],
  )
  if (!mounted) return null
  return (
    <>
      {startError && <Alert tone="danger">{startError}</Alert>}
      <AccountSettings
        api={api}
        labels={ctx.labels}
        confirmPassword={ctx.confirmPassword}
        socialProviders={resolveMethods(ctx.methods).social}
        onLinkSocial={flow && ((provider) => beginRoundTrip(provider, { kind: 'link' }))}
        onProviderReauth={flow && beginRoundTrip}
        resume={resume}
        onResumeConsumed={() =>
          navigate(location.pathname, {
            replace: true,
            state: state?.linked ? { linked: state.linked } : null,
          })
        }
        onDeleted={() => void auth.logout()}
        linkedProvider={state?.linked}
        {...settings}
      />
      {after}
    </>
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
  const page = render({ ...ctx, ...apis, ...discovered, labels })
  return ctx.now ? <CodeClockProvider now={ctx.now}>{page}</CodeClockProvider> : page
}
