import { Button, Field, Input } from '@skeleton/ui'
import { useState } from 'react'
import styles from './auth.module.css'
import type { AuthLabels } from './labels'

export type PasswordFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  labels: AuthLabels
  /** `current-password`(로그인) · `new-password`(가입 · 변경) */
  autoComplete: 'current-password' | 'new-password'
  error?: string
  hint?: string
  required?: boolean
  name?: string
  /** 칸의 `id` — 오류 요약이 이 칸으로 데려갈 수 있게 */
  id?: string
  /** 보기 토글을 밖에서 쥔다(확인 칸과 함께 보이게) — 없으면 이 칸이 혼자 쥔다 */
  shown?: boolean
  onShownChange?: (shown: boolean) => void
}

/** 비밀번호 칸 + 보이기 토글. 눌러도 값 · 포커스는 그대로 — 토글은 입력칸 옆 같은 줄에 머문다(좁은 화면에서도 줄바꿈 없음) */
export function PasswordField({
  label,
  value,
  onChange,
  labels,
  autoComplete,
  error,
  hint,
  required = true,
  name,
  id,
  shown: controlledShown,
  onShownChange,
}: PasswordFieldProps) {
  const [ownShown, setOwnShown] = useState(false)
  const shown = controlledShown ?? ownShown
  const setShown = onShownChange ?? setOwnShown
  return (
    <Field label={label} error={error} hint={hint} required={required} id={id}>
      {(control) => (
        <div className={styles.passwordRow}>
          <Input
            {...control}
            name={name}
            type={shown ? 'text' : 'password'}
            autoComplete={autoComplete}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          <Button variant="ghost" size="sm" aria-pressed={shown} onClick={() => setShown(!shown)}>
            {shown ? labels.hide : labels.show}
          </Button>
        </div>
      )}
    </Field>
  )
}
