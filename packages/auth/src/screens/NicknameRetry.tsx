import { Button, Field, Input } from '@skeleton/ui'
import styles from './auth.module.css'
import type { AuthLabels } from './labels'

export type NicknameRetryProps = {
  value: string
  onChange: (value: string) => void
  /** 「이미 쓰고 있는 닉네임이에요」 같은 칸 아래 안내 */
  error?: string
  busy?: boolean
  onSubmit: () => void
  labels: AuthLabels
}

/**
 * 가입 인증번호 단계에서 닉네임이 겹쳤을 때(`409 ACCOUNT.DISPLAY_NAME_TAKEN` — 시도는 닫히지 않는다) 그 자리에서 닉네임만 다시 입력받는 작은 칸.
 * 같은 `signUpId` · 같은 인증번호로 다시 확인하므로 비밀번호는 다시 입력하지 않고, 남은 시간은 위 패널에서 계속 흐른다.
 */
export function NicknameRetry({
  value,
  onChange,
  error,
  busy,
  onSubmit,
  labels,
}: NicknameRetryProps) {
  return (
    <form
      className={styles.form}
      aria-label={labels.displayName}
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      noValidate
    >
      <p className={styles.muted}>{labels.nicknameRetryHint}</p>
      <Field label={labels.displayName} error={error} required>
        {(control) => (
          <Input
            {...control}
            autoFocus
            autoComplete="nickname"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
      </Field>
      <div>
        <Button type="submit" loading={busy} loadingLabel={labels.submitting}>
          {labels.nicknameRetryAction}
        </Button>
      </div>
    </form>
  )
}
