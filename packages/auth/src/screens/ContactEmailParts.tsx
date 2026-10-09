import { Alert, Button, Field, FormProblems, Input, SettingsRow } from '@skeleton/ui'
import type { FormEvent, ReactNode, Ref } from 'react'
import styles from './auth.module.css'
import type { AuthLabels } from './labels'

/** 연락받을 이메일 줄 - 지금 주소(또는 「계정 이메일로 받아요」)와 등록 · 바꾸기 · 지우기 단추. 결과 알림(`notice`)은 줄 아래에 붙는다 */
export function ContactEmailSummary({
  contactEmail,
  labels,
  actions,
  removal,
  notice,
  dialogs,
  onStart,
  onRemove,
}: {
  contactEmail: string | null
  labels: AuthLabels
  actions: Ref<HTMLDivElement>
  removal: { error: { message: string } | null; busy: boolean }
  notice?: ReactNode
  /** 이 줄이 여는 대화상자들 */
  dialogs?: ReactNode
  /** 주소 입력 단계로 간다 */
  onStart: () => void
  onRemove: () => void
}) {
  return (
    <SettingsRow
      dialogs={dialogs}
      label={labels.sectionContactEmail}
      value={contactEmail ? <strong>{contactEmail}</strong> : labels.contactEmailNone}
      action={
        <div className={styles.row} ref={actions}>
          {contactEmail ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                aria-label={`${labels.sectionContactEmail} ${labels.rowChange}`}
                onClick={onStart}
              >
                {labels.rowChange}
              </Button>
              <Button
                variant="danger"
                size="sm"
                aria-label={`${labels.sectionContactEmail} ${labels.contactEmailRemove}`}
                loading={removal.busy}
                loadingLabel={labels.submitting}
                onClick={onRemove}
              >
                {labels.contactEmailRemove}
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              aria-label={`${labels.sectionContactEmail} ${labels.rowRegister}`}
              onClick={onStart}
            >
              {labels.rowRegister}
            </Button>
          )}
        </div>
      }
    >
      {notice}
      {removal.error && <Alert tone="danger">{removal.error.message}</Alert>}
    </SettingsRow>
  )
}

/** 연락받을 이메일 구역의 주소 입력 단계 */
export function ContactEmailForm({
  intro,
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
  /** 입력 위의 설명 - 이 주소가 어디에 쓰이는지 */
  intro?: ReactNode
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
      {intro}
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
