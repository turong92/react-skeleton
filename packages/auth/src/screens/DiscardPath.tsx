import { ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { Alert, Button, ConfirmDialog } from '@skeleton/ui'
import { useState } from 'react'
import styles from './EmailRequiredScreen.module.css'
import type { AuthLabels } from './labels'
import { labelOfMethod } from './methodsList'
import { useAction } from './useAction'

/**
 * 「이미 계정이 있나요?」 - 같은 사람이 이미 메일 계정이 있는데 소셜로 들어와 빈 계정이 생겼을 때의 길(`POST /account/discard`).
 * 눌러도 바로 지우지 않고 한 번 확인한다(유예 없이 되돌릴 수 없다). 성공하면 `onDiscarded` - 서버가 모든 세션을 닫았으니 앱이 로컬 세션을 지우고 로그인 화면으로 보낸다.
 * 오래된 세션이라 서버가 제공자 재동의를 요구하면(`REAUTH_REQUIRED`) 확인 창을 닫고 그 제공자 단추를 보인다 - 돌아오면 설정이 이어서 부른다.
 */
export function DiscardPath({
  labels,
  providers,
  discard,
  onDiscarded,
  onProviderReauth,
  loginId,
}: {
  labels: AuthLabels
  /** 이 계정이 로그인에 쓰는 소셜 제공자 - 안내 문장의 이름과 재동의 단추 */
  providers: string[]
  discard: () => Promise<void>
  /** 지웠다 - 인자는 로그인 뒤 연결을 이어 가게 할 제공자(없으면 undefined) */
  onDiscarded: (provider?: string) => void
  /** 재동의 단추를 눌렀다 */
  onProviderReauth?: (provider: string) => void
  /** 이 계정이 이미 정한 로그인 아이디 - 있으면 확인 문구가 「아이디 … 도 함께 사라지고 다시 쓸 수 없어요」를 덧붙인다. 아이디 게이트(아직 없다) · 아이디를 끈 서버는 비운다 */
  loginId?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [reauth, setReauth] = useState(false)
  const action = useAction(labels)
  const providerName = providers.length > 0 ? labelOfMethod(providers[0], labels) : undefined

  async function confirm() {
    const ok = await action.run(async () => {
      try {
        await discard()
      } catch (caught) {
        if (isErrorCode(caught, ErrorCodes.ACCOUNT_REAUTH_REQUIRED)) {
          setOpen(false)
          setReauth(true)
        }
        throw caught
      }
    })
    if (ok) onDiscarded(providers[0])
  }

  return (
    <section className={styles.discard} aria-labelledby="discard-title">
      <h2 id="discard-title">{labels.emailRequiredDiscardTitle}</h2>
      <p>{labels.emailRequiredDiscardBody(providerName)}</p>
      {reauth ? (
        <div className={styles.providers} data-testid="discard-reauth">
          <Alert tone="warning">
            {providerName ? labels.emailReauthNeeded(providerName) : labels.reauthProviderNone}
          </Alert>
          {providers.map((provider) => (
            <Button
              key={provider}
              disabled={!onProviderReauth}
              onClick={() => onProviderReauth?.(provider)}
            >
              {labels.reauthProviderButton(labelOfMethod(provider, labels))}
            </Button>
          ))}
        </div>
      ) : (
        <Button variant="danger" onClick={() => setOpen(true)}>
          {labels.emailRequiredDiscard}
        </Button>
      )}
      <ConfirmDialog
        open={open}
        onClose={() => {
          setOpen(false)
          action.clear()
        }}
        onConfirm={() => void confirm()}
        title={labels.emailRequiredDiscardConfirmTitle}
        description={
          <>
            <p>{labels.emailRequiredDiscardConfirmBody}</p>
            {loginId && <p>{labels.emailRequiredDiscardConfirmLoginId(loginId)}</p>}
            {action.error && <Alert tone="danger">{action.error.message}</Alert>}
          </>
        }
        confirmLabel={labels.emailRequiredDiscardConfirm}
        cancelLabel={labels.cancel}
        busy={action.busy}
      />
    </section>
  )
}
