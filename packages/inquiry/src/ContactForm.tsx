import { Alert, Button, ChoiceGroup, ErrorReference, Field, Input, Textarea } from '@skeleton/ui'
import { useId, type FormEvent, type ReactNode } from 'react'
import { useInquiryForm, type InquiryCaptcha } from './hooks'
import type { InquiryApi } from './inquiryApi'
import { defaultInquiryLabels, type InquiryLabels } from './labels'
import { INQUIRY_BODY_MAX, INQUIRY_BODY_MIN, INQUIRY_KINDS, type InquiryKind } from './types'
import styles from './ContactForm.module.css'

export type ContactFormProps = {
  api: Pick<InquiryApi, 'send'>
  /** 로그인했으면 이메일 안내 문장이 달라진다(사람 확인은 `captcha` 로 따로 정한다) */
  signedIn?: boolean
  lang?: string
  /** 앱이 붙이는 선택 문자열(어느 화면에서 왔는지 …, ≤100자) */
  context?: string
  /** 로그인한 사람의 확인된 이메일 — 사용자가 손대기 전까지만 채운다 */
  defaultEmail?: string | null
  /** 로그인하지 않았고 서버에 사람 확인이 켜져 있을 때만 준다(`useTurnstileToken()` 의 `token` · `reset` + 위젯 요소) */
  captcha?: InquiryCaptcha
  /** 보내기 단추 위에 놓을 것(개인정보 안내 한 줄 같은 앱 고지) */
  beforeSubmit?: ReactNode
  /** 보낸 뒤 — 답장 받을 이메일을 적었는지 알려 준다. 「잘 받았어요」 화면은 앱이 정한다 */
  onSent: (info: { hasEmail: boolean }) => void
  labels?: InquiryLabels
}

/**
 * 문의 · 의견 폼 — 종류(하나 고르기) · 내용 · 답장 받을 이메일 · (필요하면) 사람 확인. 상태 · 검증 · 전송은 [useInquiryForm],
 * 서버는 `modules/inquiry`. 문구는 `labels`, 고지와 「보냈어요」 화면은 앱이 정한다.
 */
export function ContactForm({
  api,
  signedIn = false,
  lang,
  context,
  defaultEmail,
  captcha,
  beforeSubmit,
  onSent,
  labels = defaultInquiryLabels,
}: ContactFormProps) {
  const form = useInquiryForm(api, { lang, context, defaultEmail, captcha, onSent })
  const kindLabelId = useId()
  const L = labels.form
  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    form.submit()
  }
  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <div className={styles.kind}>
        <span id={kindLabelId} className={styles.kindLabel}>
          {L.kind}
        </span>
        <ChoiceGroup
          aria-labelledby={kindLabelId}
          value={form.kind}
          onChange={(value) => form.setKind(value as InquiryKind)}
          options={INQUIRY_KINDS.map((value) => ({ value, label: L.kinds[value] }))}
        />
      </div>
      <Field
        label={L.body}
        hint={`${L.bodyHint} ${L.bodyCount(form.body.trim().length, INQUIRY_BODY_MAX)}`}
        error={form.problems.body ? L.bodyTooShort(INQUIRY_BODY_MIN, INQUIRY_BODY_MAX) : undefined}
        required
      >
        {(control) => (
          <Textarea
            {...control}
            rows={6}
            value={form.body}
            onChange={(event) => form.setBody(event.target.value)}
          />
        )}
      </Field>
      <Field
        label={L.email}
        hint={signedIn ? L.emailHintSignedIn : L.emailHintSignedOut}
        error={form.problems.email ? L.emailInvalid : undefined}
      >
        {(control) => (
          <Input
            {...control}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => form.setEmail(event.target.value)}
          />
        )}
      </Field>
      {captcha?.widget}
      {beforeSubmit}
      {form.captchaMissing && <Alert tone="warning">{labels.errors.captcha}</Alert>}
      {form.problem && (
        <>
          <Alert tone="danger">{labels.errors[form.problem]}</Alert>
          {form.problem === 'other' && <ErrorReference error={form.error} />}
        </>
      )}
      <div className={styles.actions}>
        <Button type="submit" loading={form.pending} loadingLabel={L.sending}>
          {L.submit}
        </Button>
      </div>
    </form>
  )
}
