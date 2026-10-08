import { Alert, Button, Field, FormProblems, Input } from '@skeleton/ui'
import type { FormEvent, ReactNode, Ref } from 'react'
import styles from './auth.module.css'
import type { AuthLabels } from './labels'

/** 연락받을 이메일 구역의 한눈에 보기 - 지금 주소(또는 「계정 이메일로 받아요」)와 등록 · 바꾸기 · 지우기 단추 */
export function ContactEmailSummary({
  contactEmail,
  labels,
  actions,
  removal,
  onStart,
  onRemove,
}: {
  contactEmail: string | null
  labels: AuthLabels
  actions: Ref<HTMLDivElement>
  removal: { error: { message: string } | null; busy: boolean }
  /** 주소 입력 단계로 간다 */
  onStart: () => void
  onRemove: () => void
}) {
  return (
    <>
      <div className={styles.row}>
        {contactEmail ? (
          <>
            <span className={styles.muted}>{labels.contactEmailCurrent}</span>
            <strong>{contactEmail}</strong>
          </>
        ) : (
          <span>{labels.contactEmailNone}</span>
        )}
      </div>
      {contactEmail && <p className={styles.muted}>{labels.contactEmailCurrentIsAccount}</p>}
      {removal.error && <Alert tone="danger">{removal.error.message}</Alert>}
      <div className={styles.row} ref={actions}>
        {contactEmail ? (
          <>
            <Button variant="secondary" onClick={onStart}>
              {labels.contactEmailChange}
            </Button>
            <Button
              variant="danger"
              loading={removal.busy}
              loadingLabel={labels.submitting}
              onClick={onRemove}
            >
              {labels.contactEmailRemove}
            </Button>
          </>
        ) : (
          <Button onClick={onStart}>{labels.contactEmailAdd}</Button>
        )}
      </div>
    </>
  )
}

/** 연락받을 이메일 구역의 주소 입력 단계 */
export function ContactEmailForm({
  labels,
  fieldId,
  email,
  onEmailChange,
  problem,
  attempted,
  error,
  busy,
  extra,
  onSubmit,
  onCancel,
}: {
  labels: AuthLabels
  fieldId: string
  email: string
  onEmailChange: (value: string) => void
  /** 고쳐야 할 이유(없으면 undefined) */
  problem: string | undefined
  /** 제출을 한 번 시도했는가 - 그 뒤에야 이유를 보인다 */
  attempted: boolean
  error: { message: string } | null
  busy: boolean
  /** 입력 아래에 더할 것 - 제공자 재동의 안내가 오면 보내기 단추 대신 이것이 선다 */
  extra?: ReactNode
  onSubmit: (event: FormEvent) => void
  onCancel: () => void
}) {
  return (
    <form
      className={styles.form}
      onSubmit={onSubmit}
      noValidate
      aria-label={labels.contactEmailSend}
    >
      {error && <Alert tone="danger">{error.message}</Alert>}
      <Field
        id={fieldId}
        label={labels.contactEmailField}
        required
        error={attempted ? problem : undefined}
      >
        {(control) => (
          <Input
            {...control}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
          />
        )}
      </Field>
      <FormProblems
        title={labels.formProblemsTitle}
        problems={attempted && problem ? [{ key: 'email', message: problem, target: fieldId }] : []}
      />
      {extra}
      <div className={styles.row}>
        {!extra && (
          <Button type="submit" loading={busy} loadingLabel={labels.submitting}>
            {labels.contactEmailSend}
          </Button>
        )}
        <Button variant="secondary" onClick={onCancel}>
          {labels.cancel}
        </Button>
      </div>
    </form>
  )
}
