import { Alert, Badge, Button, ConfirmDialog, SettingsRow } from '@skeleton/ui'
import { useEffect, useRef, useState } from 'react'
import type { ReauthCredential } from '../account/accountApi'
import type { SignInIdentity } from '../account/types'
import { isReauthFailure, reauthKindOf, type ReauthSubject } from '../reauth/kind'
import { ReauthProof } from './ReauthProof'
import { SectionShell } from './SectionShell'
import { SettingsDialog } from './SettingsDialog'
import { SocialButtons } from './SocialButtons'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'
import { canUnlink, labelOfMethod } from './methodsList'
import type { SocialProviderButton } from './methods'
import { useAction } from './useAction'

export type SignInMethodsSectionProps = {
  identities: SignInIdentity[]
  /** 이 앱이 켜 둔 소셜 제공자 — 아직 안 붙인 것만 「연결」 버튼이 생긴다 */
  socialProviders?: SocialProviderButton[]
  /** 제공자 화면으로 보낸다(돌아오는 `code` 는 앱의 연결 콜백이 `api.linkSocial` 로 보낸다) */
  onLink?: (provider: string) => void | Promise<unknown>
  /** 연결 앞의 안내(다시 인증 메일을 보냈다 …) */
  notice?: string
  /** 제공자에서 돌아와 이어 한 연결 해제가 실패했다 - 스크롤해 온 이 구역에서 이유를 말한다 */
  failure?: string
  /** 다시 인증이 든다(서버가 강제) — 비밀번호 · 메일 인증번호 · `socialReauth`. 마지막 수단은 409 */
  onUnlink: (identityId: string, reauth: ReauthCredential) => Promise<unknown>
  /** 다시 인증의 종류를 고르는 `me` 의 부분(`reauthSubjectOf(me)`) */
  subject: ReauthSubject
  /** `POST /account/reauth/confirmation` — 비밀번호 없는 계정의 인증번호 메일 */
  requestReauthCode: () => Promise<unknown>
  /** 주소가 없는 계정: 이 제공자의 동의를 다시 거친 뒤 이어서 뗀다(하려던 작업은 부모가 state 에 묶는다) */
  onProviderReauth?: (provider: string, identityId: string) => void
  /**
   * 소셜 로그인이 「같은 이메일의 계정이 있다」(409)로 막혀 로그인하고 온 사용자 — 「{제공자} 연결을 이어서 하세요」 한 줄과 그 제공자의 「연결」 단추를 강조하고(화면에 들어오면 포커스) 보인다.
   * 이미 연결됐거나 이 앱이 안 켠 제공자면 아무것도 더하지 않는다
   */
  linkIntent?: { provider: string }
  formatDate?: (iso: string) => string
  /** 첫 렌더부터 목록 대화상자가 열려 있다 - 제공자 왕복(연결 · 해제)에서 돌아온 결과를 그 안에서 말한다 */
  initiallyOpen?: boolean
  /** 줄만 그린다(`AccountSettings` 의 카드 안) - 아니면 제목 있는 카드 한 장에 담는다 */
  row?: boolean
  labels?: Partial<AuthLabels>
}

const defaultFormat = (iso: string) => new Date(iso).toLocaleDateString()

/** 로그인 수단 절 — 마지막 수단은 뗄 수 없고(왜인지 말해 준다), 뗄 때는 확인을 거친다 */
export function SignInMethodsSection({
  identities,
  socialProviders = [],
  onLink,
  onUnlink,
  subject,
  requestReauthCode,
  onProviderReauth,
  notice,
  failure,
  linkIntent,
  formatDate = defaultFormat,
  initiallyOpen = false,
  row,
  labels: given,
}: SignInMethodsSectionProps) {
  const labels = mergeLabels(given)
  const [target, setTarget] = useState<SignInIdentity | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [proof, setProof] = useState<ReauthCredential | null>(null)
  const action = useAction(labels)
  const kind = reauthKindOf(subject)
  const linkable = socialProviders.filter((p) => !identities.some((i) => i.method === p.provider))

  const resuming =
    linkIntent && onLink && linkable.some((p) => p.provider === linkIntent.provider)
      ? linkIntent.provider
      : undefined
  // 이어서 할 연결이 있으면 목록 대화상자가 처음부터 열려 있다
  const [open, setOpen] = useState(initiallyOpen || !!resuming)
  const section = useRef<HTMLDivElement | null>(null)
  // 이어서 할 단추로 데려온다 — 구역이 화면에 들어오고 그 단추에 포커스가 있다(한 번만)
  useEffect(() => {
    if (!resuming || !open) return
    const button = section.current?.querySelector<HTMLElement>('[data-link-intent]')
    button?.scrollIntoView?.({ block: 'center' })
    button?.focus({ preventScroll: true })
  }, [resuming, open])

  const close = () => {
    setTarget(null)
    setProof(null)
    action.clear()
  }

  async function confirm() {
    if (!target || kind === 'provider') return
    let rejected = false
    const ok = await action.run(async () => {
      try {
        await onUnlink(target.id, proof ?? {})
      } catch (error) {
        rejected = isReauthFailure(error)
        throw error
      }
    })
    // 증거가 거절되면 창을 열어 둔 채 그 자리에서 다시(틀린 비밀번호 · 인증번호) — 그 밖의 결과면 닫는다
    if (!ok && rejected) return
    close()
    if (ok) setMessage(labels.methodUnlinked)
  }

  return (
    <SectionShell row={row} id="methods" title={labels.sectionMethods}>
      <SettingsRow
        label={labels.sectionMethods}
        value={identities.map((i) => labelOfMethod(i.method, labels)).join(' · ')}
        action={
          <Button
            variant="secondary"
            size="sm"
            aria-label={`${labels.sectionMethods} ${labels.rowManage}`}
            onClick={() => setOpen(true)}
          >
            {labels.rowManage}
          </Button>
        }
        dialogs={
          <>
            <SettingsDialog
              open={open}
              onClose={() => setOpen(false)}
              title={labels.sectionMethods}
              closeLabel={labels.dialogClose}
            >
              <div className={styles.stack} ref={section}>
                <p className={styles.muted}>{labels.methodsDescription}</p>
                {action.error && !target && <Alert tone="danger">{action.error.message}</Alert>}
                {message && <Alert tone="success">{message}</Alert>}
                {failure && <Alert tone="danger">{failure}</Alert>}
                {notice && <Alert tone="info">{notice}</Alert>}
                {resuming && (
                  <Alert tone="info">
                    {labels.methodLinkContinue(labelOfMethod(resuming, labels))}
                  </Alert>
                )}
                <ul className={styles.list}>
                  {identities.map((identity) => {
                    const removable = canUnlink(identity, identities)
                    return (
                      <li key={identity.id} className={styles.item}>
                        <div className={styles.itemText}>
                          <strong>
                            {labelOfMethod(identity.method, labels)}
                            {identity.subject && (
                              <span className={styles.muted}> {identity.subject}</span>
                            )}
                          </strong>
                          <span className={styles.muted}>
                            {identity.lastUsedAt
                              ? labels.methodLastUsed(formatDate(identity.lastUsedAt))
                              : labels.methodNeverUsed}
                          </span>
                          {!removable && (
                            <span className={styles.muted}>{labels.methodsLastProtected}</span>
                          )}
                        </div>
                        <div className={styles.row}>
                          {!identity.verified && (
                            <Badge tone="warning">{labels.emailUnverified}</Badge>
                          )}
                          {removable && (
                            <Button variant="danger" size="sm" onClick={() => setTarget(identity)}>
                              {labels.methodUnlink}
                            </Button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
                {linkable.length > 0 && onLink && (
                  <SocialButtons
                    providers={linkable}
                    labels={labels}
                    onSelect={onLink}
                    highlight={resuming}
                    textOf={(_, name) => labels.methodLink(name)}
                  />
                )}
              </div>
            </SettingsDialog>
            <ConfirmDialog
              open={target !== null}
              onClose={close}
              onConfirm={confirm}
              confirmDisabled={kind === 'provider' || proof === null}
              title={labels.methodUnlinkTitle(target ? labelOfMethod(target.method, labels) : '')}
              description={
                <div className={styles.stack}>
                  <p>{labels.methodUnlinkBody}</p>
                  {action.error && !isReauthFailure(action.raw) && (
                    <Alert tone="danger">{action.error.message}</Alert>
                  )}
                  <ReauthProof
                    key={target?.id}
                    kind={kind}
                    email={subject.email}
                    providers={subject.providers}
                    requestCode={requestReauthCode}
                    onChange={setProof}
                    failure={isReauthFailure(action.raw) ? action.raw : undefined}
                    onProvider={
                      onProviderReauth && target
                        ? (provider) => onProviderReauth(provider, target.id)
                        : undefined
                    }
                    labels={given}
                  />
                </div>
              }
              confirmLabel={labels.methodUnlink}
              cancelLabel={labels.cancel}
              closeLabel={labels.cancel}
              busy={action.busy}
            />
          </>
        }
      />
    </SectionShell>
  )
}
