import { Field, Input } from '@skeleton/ui'
import { guestProblems, type GuestDraft, type GuestUi } from './guestUi'
import type { GuestLabels } from './guestLabels'
import styles from './GuestFields.module.css'

export type GuestFieldsProps = {
  ui: GuestUi
  labels: GuestLabels
  value: GuestDraft
  onChange: (next: GuestDraft) => void
  /** 제출을 한 번 막은 뒤부터 칸 오류를 보인다 */
  showErrors?: boolean
  /** 고치기 · 지우기 — 이름 없이 비밀만 묻는다 */
  secretOnly?: boolean
  /** 칸 이름 접두사 — 한 화면에 폼이 여럿일 때 `name` 이 겹치지 않게 */
  idPrefix?: string
}

/** 비회원 칸 — 이름 + 비밀번호(`PASSWORD` 일 때만) + 캡차 자리. 비밀은 화면에 저장하지 않는다(`autoComplete="off"`) */
export function GuestFields({
  ui,
  labels,
  value,
  onChange,
  showErrors,
  secretOnly,
  idPrefix = 'guest',
}: GuestFieldsProps) {
  const problems = showErrors ? guestProblems(value, ui, labels) : {}
  return (
    <div className={styles.fields}>
      {!secretOnly && (
        <Field label={labels.guestName} error={problems.name}>
          {(control) => (
            <Input
              {...control}
              name={`${idPrefix}Name`}
              autoComplete="off"
              maxLength={ui.nameMaxLength + 10}
              value={value.name}
              onChange={(event) => onChange({ ...value, name: event.target.value })}
            />
          )}
        </Field>
      )}
      {ui.secretKind === 'PASSWORD' && (
        <Field label={labels.guestSecret} hint={labels.guestSecretHint} error={problems.secret}>
          {(control) => (
            <Input
              {...control}
              type="password"
              name={`${idPrefix}Secret`}
              autoComplete="new-password"
              value={value.secret}
              onChange={(event) => onChange({ ...value, secret: event.target.value })}
            />
          )}
        </Field>
      )}
      {!secretOnly && ui.captchaRequired && ui.renderCaptcha && (
        <div>
          {ui.renderCaptcha((token) => onChange({ ...value, captchaToken: token }))}
          {problems.captcha && (
            <p role="alert" className={styles.error}>
              {problems.captcha}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
