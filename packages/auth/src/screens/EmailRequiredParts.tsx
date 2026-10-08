import { Alert, Button, Field, FormProblems, Input } from '@skeleton/ui'
import styles from './EmailRequiredScreen.module.css'
import type { AuthLabels } from './labels'
import { labelOfMethod } from './methodsList'

/**
 * 서버가 1시간이 지난 첫 등록에 제공자 재동의를 요구했다: 한 줄 안내와 제공자마다 채운 단추.
 * 쓸 수 있는 제공자가 없으면(계정에 연결된 것이 없거나 앱이 켜지 않았다) 「문의해 주세요」와 함께 처음 단계로 돌아가는 「다시 시도」가 남는다 - 막다른 길이 아니다
 */
export function ReauthPrompt({
  labels,
  providers,
  canContinue,
  losesDraft = false,
  onProvider,
  onRetry,
}: {
  labels: AuthLabels
  providers: string[]
  /** 새 주소가 올바르게 적혔고 앱이 동의 화면을 열 수 있다 */
  canContinue: boolean
  /** 쓰기용 모습 - 제공자 화면에 다녀오면 쓰던 내용이 사라진다(붙잡은 호출도 함께). 떠나기 전에 한 줄로 말한다 */
  losesDraft?: boolean
  onProvider: (provider: string) => void
  onRetry: () => void
}) {
  const providerName = providers.length > 0 ? labelOfMethod(providers[0], labels) : null
  return (
    <div className={styles.providers} data-testid="email-reauth">
      <Alert tone="warning">
        {providerName ? labels.emailReauthNeeded(providerName) : labels.reauthProviderNone}
      </Alert>
      {losesDraft && providerName && <p>{labels.emailRequiredReauthLosesDraft(providerName)}</p>}
      {providers.length === 0 && (
        <Button variant="secondary" onClick={onRetry}>
          {labels.emailRequiredRetry}
        </Button>
      )}
      {providers.map((provider) => (
        <Button key={provider} disabled={!canContinue} onClick={() => onProvider(provider)}>
          {labels.reauthProviderButton(labelOfMethod(provider, labels))}
        </Button>
      ))}
    </div>
  )
}

/** 떠나는 길 - 로그아웃은 늘 있다(계정을 지우는 길은 `DiscardPath`). 쓰기용 모습에는 「나중에 하기」(닫고 읽기를 계속한다)가 하나 더 있다 */
export function LeaveActions({
  labels,
  onSignOut,
  onLater,
}: {
  labels: AuthLabels
  onSignOut: () => void
  onLater?: () => void
}) {
  return (
    <div className={styles.leave}>
      <div className={styles.leaveActions}>
        {onLater && (
          <Button variant="secondary" onClick={onLater}>
            {labels.emailRequiredLater}
          </Button>
        )}
        <Button variant="secondary" onClick={onSignOut}>
          {labels.emailRequiredSignOut}
        </Button>
      </div>
    </div>
  )
}

/** 주소 칸 - 이유(`problem`)가 있으면 칸 아래와 요약에 같이 말하고 그 칸으로 데려간다(단추는 늘 눌린다) */
export function AddressField({
  labels,
  id,
  value,
  onChange,
  problem,
}: {
  labels: AuthLabels
  id: string
  value: string
  onChange: (value: string) => void
  problem: string | undefined
}) {
  return (
    <>
      <Field id={id} label={labels.emailRequiredField} required error={problem}>
        {(control) => (
          <Input
            {...control}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </Field>
      <FormProblems
        title={labels.formProblemsTitle}
        problems={problem ? [{ key: 'email', message: problem, target: id }] : []}
      />
    </>
  )
}
