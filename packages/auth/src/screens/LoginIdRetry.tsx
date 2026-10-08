import { Button } from '@skeleton/ui'
import { useState } from 'react'
import type { LoginIdRules } from '../account/loginIdRules'
import type { LoginIdAvailability } from '../account/types'
import styles from './auth.module.css'
import type { AuthLabels } from './labels'
import { LoginIdField } from './LoginIdField'
import { useLoginIdAvailability } from './useLoginIdAvailability'

export type LoginIdRetryProps = {
  /** 처음 칸에 들어갈 값 - 그 사이 나간 아이디(고쳐 쓰기 쉽게) */
  initialValue?: string
  rules: LoginIdRules
  /** `checkLoginId` 만 쓴다 - `accountApi` 를 그대로 넘기면 된다 */
  api: { checkLoginId: (loginId: string) => Promise<LoginIdAvailability> }
  /** 「이미 쓰고 있어요」 같은 칸 옆 오류 - 값이 바뀌면 `onChange` 에서 부모가 비운다 */
  error?: string
  busy?: boolean
  /** 형식이 맞고 「쓸 수 없다」가 아닐 때만 불린다 - 서버로 갈 값(앞뒤 공백 제거 + 소문자) */
  onSubmit: (normalized: string) => void
  onChange?: (value: string) => void
  labels: AuthLabels
}

/**
 * 가입 인증번호 단계에서 아이디가 그 사이 나갔을 때(`409 ACCOUNT.LOGIN_ID_TAKEN` - 시도는 닫히지 않는다) 그 자리에서 아이디만 다시 받는 작은 칸 - `NicknameRetry` 와 같은 조각.
 * 같은 `signUpId` · 같은 인증번호로 다시 내므로 비밀번호도 인증번호도 다시 받지 않고, 남은 시간은 위 패널에서 계속 흐른다. 실시간 확인이 가입 칸과 같이 붙는다.
 */
export function LoginIdRetry({
  initialValue = '',
  rules,
  api,
  error,
  busy,
  onSubmit,
  onChange,
  labels,
}: LoginIdRetryProps) {
  const [value, setValue] = useState(initialValue)
  const check = useLoginIdAvailability({ api, value, rules })
  return (
    <form
      className={styles.form}
      aria-label={labels.loginId}
      onSubmit={(event) => {
        event.preventDefault()
        check.touch()
        if (check.canSubmit) onSubmit(check.normalized)
      }}
      noValidate
    >
      <p className={styles.muted}>{labels.loginIdRetryHint}</p>
      <LoginIdField
        value={value}
        onChange={(next) => {
          setValue(next)
          onChange?.(next)
        }}
        check={check}
        rules={rules}
        labels={labels}
        serverError={error}
        autoFocus
      />
      <div>
        <Button type="submit" loading={busy} loadingLabel={labels.submitting}>
          {labels.loginIdRequiredSubmit}
        </Button>
      </div>
    </form>
  )
}
