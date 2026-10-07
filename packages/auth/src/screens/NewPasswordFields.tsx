import { Field, Input } from '@skeleton/ui'
import { useState } from 'react'
import { PasswordField } from './PasswordField'
import styles from './auth.module.css'
import type { AuthLabels } from './labels'
import type { PasswordConfirm } from './passwordConfirm'

export type NewPasswordFieldsProps = {
  label: string
  labels: AuthLabels
  value: string
  onChange: (value: string) => void
  /** 확인 칸의 상태(`usePasswordConfirm`) — `enabled` 가 아니면 확인 칸을 그리지 않는다 */
  confirm: PasswordConfirm
  /** 비밀번호 칸의 오류(제출을 시도한 뒤의 비었음 같은 것) */
  error?: string
  /** 칸의 `id` — 오류 요약이 데려갈 자리 */
  ids: { password: string; confirm: string }
}

/**
 * 새 비밀번호 칸 + 비밀번호 확인 칸(가입 · 재설정 · 변경 · 첫 설정). 「보기」 하나가 두 칸을 함께 보이고, 둘 다 `new-password` 라
 * 비밀번호 관리자가 두 칸을 같이 채우며 붙여넣기도 막지 않는다. 확인 칸은 건드린 뒤부터 일치 여부를 바로 알려 준다.
 */
export function NewPasswordFields({
  label,
  labels,
  value,
  onChange,
  confirm,
  error,
  ids,
}: NewPasswordFieldsProps) {
  const [shown, setShown] = useState(false)
  return (
    <>
      <PasswordField
        id={ids.password}
        label={label}
        labels={labels}
        autoComplete="new-password"
        value={value}
        onChange={onChange}
        error={error}
        shown={shown}
        onShownChange={setShown}
      />
      {confirm.enabled && (
        <Field
          id={ids.confirm}
          label={labels.passwordConfirm}
          required
          error={confirm.error}
          hint={confirm.matches ? labels.passwordMatches : undefined}
        >
          {(control) => (
            <Input
              {...control}
              type={shown ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm.value}
              data-matches={confirm.matches ? 'true' : undefined}
              className={confirm.matches ? styles.matches : undefined}
              onChange={(event) => {
                confirm.setValue(event.target.value)
                if (event.target.value !== '') confirm.touch()
              }}
              onBlur={confirm.touch}
            />
          )}
        </Field>
      )}
    </>
  )
}
