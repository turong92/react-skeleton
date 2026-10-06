import { Alert, Badge, Button, ConfirmDialog, SectionCard } from '@skeleton/ui'
import { useState } from 'react'
import type { SignInIdentity } from '../account/types'
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
  onUnlink: (identityId: string) => Promise<unknown>
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
  notice,
  formatDate = defaultFormat,
  labels: given,
}: SignInMethodsSectionProps) {
  const labels = mergeLabels(given)
  const [target, setTarget] = useState<SignInIdentity | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const action = useAction(labels)
  const linkable = socialProviders.filter((p) => !identities.some((i) => i.method === p.provider))

  async function confirm() {
    if (!target) return
    const ok = await action.run(() => onUnlink(target.id))
    setTarget(null)
    if (ok) setMessage(labels.methodUnlinked)
  }

  return (
    <SectionCard id="methods" title={labels.sectionMethods} description={labels.methodsDescription}>
      <div className={styles.stack}>
        {action.error && <Alert tone="danger">{action.error.message}</Alert>}
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
        onClose={() => setTarget(null)}
        onConfirm={confirm}
        title={labels.methodUnlinkTitle(target ? labelOfMethod(target.method, labels) : '')}
        description={labels.methodUnlinkBody}
        confirmLabel={labels.methodUnlink}
        cancelLabel={labels.cancel}
        closeLabel={labels.cancel}
        busy={action.busy}
      />
    </SectionCard>
  )
}
