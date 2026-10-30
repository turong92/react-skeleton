import { formatInstant } from '@skeleton/time'
import { Alert, Button, Card, ErrorReference, Skeleton } from '@skeleton/ui'
import { useEffect, useRef, useState } from 'react'
import { invitationProblem, type InvitationProblem } from './errors'
import { useAcceptInvitation, useInvitationPreview } from './hooks'
import {
  browserSessionStorage,
  createInvitationTokenStore,
  takeInvitationToken,
  type InvitationTokenStore,
  type TokenStorage,
  type UrlHost,
} from './invitationToken'
import { defaultWorkspaceLabels, type WorkspaceLabels } from './labels'
import type { InvitationPreview, WorkspaceSummary } from './types'
import type { WorkspaceApi } from './workspaceApi'
import styles from './AcceptInvitation.module.css'

export type AcceptInvitationProps = {
  api: Pick<WorkspaceApi, 'previewInvitation' | 'acceptInvitation'>
  /** 로그인했는가 — 앱의 인증 상태. 아니면 미리보기 아래에 「로그인 · 가입 후 수락」이 나온다 */
  signedIn: boolean
  /** 「로그인 · 가입 후 수락」 — 앱이 로그인(또는 가입) 화면으로 보낸다. 토큰은 이 탭에 남아 있어 돌아오면 이어진다 */
  onSignIn: () => void
  /** 수락이 끝났을 때 — 앱이 그 워크스페이스의 `/w/<slug>` 로 이동한다(라우터를 이 패키지가 모른다) */
  onAccepted: (workspace: WorkspaceSummary) => void
  /** 있으면 끝난 화면(죽은 초대 · 이미 멤버 · 주소가 다른 계정)에 「처음 화면으로」가 생긴다 */
  onGoHome?: () => void
  labels?: WorkspaceLabels
  locale?: string
  formatTime?: (iso: string) => string
  /** 토큰을 보관할 탭 저장소(기본 `sessionStorage`) — 시험 · 스토리용 */
  storage?: TokenStorage
  /** 주소창(기본 `window`) — 시험 · 스토리용 */
  urlHost?: UrlHost
}

/** `ALREADY_MEMBER` 오류 본문의 `{id, slug}` — 없거나 모양이 다르면 null(그때는 안내 문장만) */
function memberOf(error: unknown): { id: string; slug: string } | null {
  const data = (error as { apiError?: { data?: unknown } }).apiError?.data
  if (typeof data !== 'object' || data === null) return null
  const { id, slug } = data as { id?: unknown; slug?: unknown }
  return typeof id === 'string' && typeof slug === 'string' ? { id, slug } : null
}

/** 토큰이 쓸모없어진 문제 — 탭에서 지운다 */
const DEAD: readonly InvitationProblem[] = ['expired', 'used', 'invalid', 'alreadyMember']
/** 같은 계정으로 다시 해 봐도 소용없는 문제 — 「수락」 단추를 거둔다(주소가 다른 계정은 토큰을 지우지 않는다: 계정을 바꿔 돌아오면 이어서 쓴다) */
const TERMINAL: readonly InvitationProblem[] = [...DEAD, 'emailMismatch']

/**
 * 초대 수락 화면(`/invite?token=…`) — 토큰을 읽어 이 탭 저장소로 옮기고 주소창에서 지운 뒤(`takeInvitationToken`) 미리보기를 보여 준다.
 * 로그인 안 했으면 「로그인 · 가입 후 수락」, 돌아오면(주소에 토큰이 없어도 탭 저장소에서) 「초대 수락」. 오류는 코드별 문장으로 푼다.
 * 서버에서는 토큰을 읽지 않는다(효과에서만) — 로딩 자리표시만 그린다
 */
export function AcceptInvitation({
  api,
  signedIn,
  onSignIn,
  onAccepted,
  onGoHome,
  labels = defaultWorkspaceLabels,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
  storage,
  urlHost,
}: AcceptInvitationProps) {
  const t = labels.accept
  // undefined = 아직 안 읽음(서버 · 첫 그리기) · null = 어디에도 없음
  const [token, setToken] = useState<string | null | undefined>(undefined)
  const store = useRef<InvitationTokenStore | null>(null)
  const taken = useRef(false)
  const preview = useInvitationPreview(api, token ?? null)
  const accept = useAcceptInvitation(api)

  useEffect(() => {
    // StrictMode 가 효과를 두 번 돌려도 한 번만 — 두 번째에는 주소창에서 이미 지워졌다
    if (taken.current) return
    taken.current = true
    store.current = createInvitationTokenStore(storage ?? browserSessionStorage())
    setToken(takeInvitationToken(store.current, urlHost))
  }, [storage, urlHost])

  const previewProblem = preview.isError ? invitationProblem(preview.error) : null
  const acceptProblem = accept.isError ? invitationProblem(accept.error) : null
  const dead = previewProblem !== null && DEAD.includes(previewProblem)
  useEffect(() => {
    // 죽은 토큰은 탭에 남기지 않는다
    if (dead) store.current?.clear()
  }, [dead])
  const { reset: resetAccept } = accept
  useEffect(() => {
    // 로그인 상태가 바뀌면(계정을 바꿔 돌아왔다) 앞 계정의 수락 오류는 버린다
    resetAccept()
  }, [signedIn, resetAccept])

  const goHome = onGoHome && (
    <Button variant="secondary" onClick={onGoHome}>
      {t.goHome}
    </Button>
  )
  const terminal = (message: string, error?: unknown) => (
    <Card title={t.title}>
      <div className={styles.page}>
        <Alert tone="danger">{message}</Alert>
        {error !== undefined && <ErrorReference error={error} />}
        {goHome && <div className={styles.actions}>{goHome}</div>}
      </div>
    </Card>
  )

  if (token === undefined || (token !== null && preview.isPending))
    return (
      <Card title={t.title}>
        <Skeleton lines={3} label={labels.loading} />
      </Card>
    )
  if (token === null) return terminal(t.problems.invalid)
  if (preview.isError) {
    if (previewProblem === 'expired') return terminal(t.problems.expired)
    if (previewProblem === 'used') return terminal(t.problems.used)
    if (previewProblem === 'invalid') return terminal(t.problems.invalid)
    return (
      <Card title={t.title}>
        <div className={styles.page}>
          <Alert
            tone="danger"
            action={
              <Button variant="secondary" size="sm" onClick={() => void preview.refetch()}>
                {labels.retry}
              </Button>
            }
          >
            {labels.loadFailed}
          </Alert>
          <ErrorReference error={preview.error} />
        </div>
      </Card>
    )
  }

  const info = preview.data as InvitationPreview
  const problemText = (problem: InvitationProblem): string => {
    switch (problem) {
      case 'expired':
        return t.problems.expired
      case 'used':
        return t.problems.used
      case 'invalid':
        return t.problems.invalid
      case 'emailMismatch':
        return t.problems.emailMismatch(info.emailMasked)
      case 'emailUnverified':
        return t.problems.emailUnverified
      case 'alreadyMember':
        return t.problems.alreadyMember
      case 'seatLimit':
        return t.problems.seatLimit
      default:
        return t.problems.failed
    }
  }

  return (
    <Card title={t.title}>
      <div className={styles.page}>
        <p className={styles.lead}>{t.invitedTo(info.workspaceName)}</p>
        <ul className={styles.facts}>
          {info.inviterLabel && <li className={styles.fact}>{t.invitedBy(info.inviterLabel)}</li>}
          <li className={styles.fact}>{t.asRole(labels.roles[info.role])}</li>
          <li className={styles.fact}>{t.sentTo(info.emailMasked)}</li>
          <li className={styles.fact}>{t.expiresAt(formatTime(info.expiresAt))}</li>
        </ul>
        {accept.isError && acceptProblem && (
          <>
            <Alert tone="danger">{problemText(acceptProblem)}</Alert>
            <ErrorReference error={accept.error} />
          </>
        )}
        {signedIn ? (
          <div className={styles.actions}>
            {!(acceptProblem && TERMINAL.includes(acceptProblem)) && (
              <Button
                loading={accept.isPending}
                loadingLabel={labels.loading}
                onClick={() =>
                  accept.mutate(token, {
                    onSuccess: (workspace) => {
                      store.current?.clear()
                      onAccepted(workspace)
                    },
                    onError: (error) => {
                      // 이미 멤버면 초대는 서버가 닫았고, 죽은 토큰은 쓸 데가 없다
                      if (DEAD.includes(invitationProblem(error))) store.current?.clear()
                      // 이미 멤버: 서버가 알려 준 그 팀으로 보낸다(수락과 같은 길). 역할은 이 초대의 것 - 앱은 slug 만 쓴다
                      const member = invitationProblem(error) === 'alreadyMember' && memberOf(error)
                      if (member)
                        onAccepted({ ...member, name: info.workspaceName, role: info.role })
                    },
                  })
                }
              >
                {t.accept}
              </Button>
            )}
            {acceptProblem && TERMINAL.includes(acceptProblem) && goHome}
          </div>
        ) : (
          <>
            <p className={styles.fact}>{t.signInHint}</p>
            <div className={styles.actions}>
              <Button onClick={onSignIn}>{t.signIn}</Button>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
