import { Field, Input } from '@skeleton/ui'
import { useId } from 'react'
import type { LoginIdRules } from '../account/loginIdRules'
import styles from './auth.module.css'
import type { AuthLabels } from './labels'
import { loginIdFieldError } from './loginId'
import type { LoginIdCheck } from './useLoginIdAvailability'

export type LoginIdFieldProps = {
  /** 입력한 그대로의 값 — 부모가 쥔다(가입 · 인증 단계 재입력 · 게이트 · 설정이 같은 칸을 쓴다) */
  value: string
  onChange: (value: string) => void
  /** `useLoginIdAvailability({ api, value, rules })` 의 반환 — 부모가 `check.canSubmit` · `check.normalized` 로 내고, 제출 단추에서 `check.touch()` 를 부른다 */
  check: LoginIdCheck
  rules: LoginIdRules
  labels: AuthLabels
  /** 서버가 돌려준 오류(`409 LOGIN_ID_TAKEN` · `errors[].field=loginId`)를 칸 옆에 꽂는다 — 있으면 실시간 확인의 오류보다 앞선다. 값이 바뀌면 부모가 비운다 */
  serverError?: string
  label?: string
  /** 칸 아래 안내 — 기본은 「영문 · 숫자 …」, `false` 면 없앤다 */
  hint?: string | false
  name?: string
  /** 칸의 `id` — 오류 요약이 이 칸으로 데려갈 수 있게 */
  id?: string
  required?: boolean
  disabled?: boolean
  autoFocus?: boolean
  onBlur?: () => void
}

const GLYPH = { checking: '○', available: '✓', unknown: '!' } as const

/**
 * 로그인 아이디 칸 — 라벨 · 안내 한 줄 · 상태 한 줄(글자 + 아이콘, `aria-live="polite"`). 상태는 색이 아니라 글자로 말한다.
 * 오류(형식 · 쓸 수 없다 · 서버)는 다른 칸처럼 칸 옆 `role="alert"` 로 나오고, 그동안 상태 줄은 비어 있다.
 */
export function LoginIdField({
  value,
  onChange,
  check,
  rules,
  labels,
  serverError,
  label,
  hint,
  name,
  id: givenId,
  required = true,
  disabled,
  autoFocus,
  onBlur,
}: LoginIdFieldProps) {
  const generated = useId()
  const id = givenId ?? generated
  const statusId = `${id}-status`
  const error = loginIdFieldError(check, rules, labels, serverError)
  const status = error ? undefined : statusOf(check, labels)
  return (
    <div className={styles.loginIdField}>
      <Field
        id={id}
        label={label ?? labels.loginId}
        hint={
          hint === false
            ? undefined
            : (hint ?? labels.loginIdHint(rules.minLength, rules.maxLength))
        }
        error={error}
        required={required}
      >
        {(control) => (
          <Input
            {...control}
            aria-describedby={[control['aria-describedby'], statusId].filter(Boolean).join(' ')}
            name={name}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            disabled={disabled}
            autoFocus={autoFocus}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={() => {
              check.touch()
              onBlur?.()
            }}
          />
        )}
      </Field>
      <p id={statusId} aria-live="polite" className={styles.idStatus} data-status={status?.kind}>
        {status && (
          <>
            <span aria-hidden="true">{GLYPH[status.kind]}</span>
            <span>{status.text}</span>
          </>
        )}
      </p>
    </div>
  )
}

function statusOf(
  check: LoginIdCheck,
  labels: AuthLabels,
): { kind: keyof typeof GLYPH; text: string } | undefined {
  switch (check.status) {
    case 'checking':
      return { kind: 'checking', text: labels.loginIdChecking }
    case 'available':
      return {
        kind: 'available',
        text: check.savedAsNormalized
          ? `${labels.loginIdAvailable} · ${labels.loginIdSavedAs(check.normalized)}`
          : labels.loginIdAvailable,
      }
    case 'unknown':
      return { kind: 'unknown', text: labels.loginIdCheckUnknown }
    default:
      return undefined
  }
}
