import { Alert, Badge, Button, ConfirmDialog, SectionCard } from '@skeleton/ui'
import { useState } from 'react'
import type { ReauthCredential } from '../account/accountApi'
import type { SignInIdentity } from '../account/types'
import { isReauthFailure, reauthKindOf, type ReauthSubject } from '../reauth/kind'
import { ReauthProof } from './ReauthProof'
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
  /** 다시 인증이 든다(서버가 강제) — 비밀번호 · 메일 인증번호 · `socialReauth`. 마지막 수단은 409 */
  onUnlink: (identityId: string, reauth: ReauthCredential) => Promise<unknown>
  /** 다시 인증의 종류를 고르는 `me` 의 부분(`reauthSubjectOf(me)`) */
  subject: ReauthSubject
  /** `POST /account/reauth/confirmation` — 비밀번호 없는 계정의 인증번호 메일 */
  requestReauthCode: () => Promise<unknown>
  /** 주소가 없는 계정: 이 제공자의 동의를 다시 거친 뒤 이어서 뗀다(하려던 작업은 부모가 state 에 묶는다) */
  onProviderReauth?: (provider: string, identityId: string) => void
  formatDate?: (iso: string) => string
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
  formatDate = defaultFormat,
  labels: given,
}: SignInMethodsSectionProps) {
  const labels = mergeLabels(given)
  const [target, setTarget] = useState<SignInIdentity | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [proof, setProof] = useState<ReauthCredential | null>(null)
  const action = useAction(labels)
  const kind = reauthKindOf(subject)
  const linkable = socialProviders.filter((p) => !identities.some((i) => i.method === p.provider))

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
    <SectionCard id="methods" title={labels.sectionMethods} description={labels.methodsDescription}>
      <div className={styles.stack}>
        {action.error && !target && <Alert tone="danger">{action.error.message}</Alert>}
        {message && <Alert tone="success">{message}</Alert>}
        {notice && <Alert tone="info">{notice}</Alert>}
        <ul className={styles.list}>
          {identities.map((identity) => {
            const removable = canUnlink(identity, identities)
            return (
              <li key={identity.id} className={styles.item}>
                <div className={styles.itemText}>
                  <strong>
                    {labelOfMethod(identity.method, labels)}
                    {identity.subject && <span className={styles.muted}> {identity.subject}</span>}
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
                  {!identity.verified && <Badge tone="warning">{labels.emailUnverified}</Badge>}
                  {removable && (
                    <Button variant="secondary" size="sm" onClick={() => setTarget(identity)}>
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
            textOf={(_, name) => labels.methodLink(name)}
          />
        )}
      </div>
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
    </SectionCard>
  )
}
