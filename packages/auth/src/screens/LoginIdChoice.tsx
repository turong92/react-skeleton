import { Alert, Button, ConfirmDialog, FormProblems, useSubmitAttempt } from '@skeleton/ui'
import { useId, useState, type FormEvent } from 'react'
import type { LoginIdRules } from '../account/loginIdRules'
import type { LoginIdAvailability } from '../account/types'
import authStyles from './auth.module.css'
import type { AuthLabels } from './labels'
import { loginIdFieldError } from './loginId'
import { LoginIdField } from './LoginIdField'
import { loginIdSubmitOutcome, type LoginIdSubmitOutcome } from './loginIdRequiredOutcome'
import { useAction } from './useAction'
import { useLoginIdAvailability } from './useLoginIdAvailability'

export type LoginIdChoiceProps = {
  rules: LoginIdRules
  /** `checkLoginId` 만 쓴다 — 실시간 확인 */
  api: { checkLoginId: (loginId: string) => Promise<LoginIdAvailability> }
  /** `POST /account/login-id { loginId }` — 정규화한 값으로 부른다. 던진 `409 LOGIN_ID_TAKEN` · 필드 오류는 칸 옆 오류가 된다 */
  onSubmit: (loginId: string) => Promise<unknown>
  /** 정했다 */
  onChosen: () => void
  /** 서버가 `409 LOGIN_ID_ALREADY_SET` 이라 했다 — 다른 탭에서 정했다 */
  onAlreadySet: () => void
  /** 폼의 이름이 되는 제목 요소의 id (`aria-labelledby`) */
  labelledBy: string
  /** 제출 단추에 더하는 클래스 */
  submitClassName?: string
  /** 전부 채워진 문구 */
  labels: AuthLabels
}

/**
 * 아이디를 정하는 한 덩어리 — 아이디 칸(실시간 확인) + 채워진 단추 「이 아이디로 정하기」 + **확인 대화상자**(정한 뒤에는 바꿀 수 없어요).
 * 게이트 화면(`LoginIdRequiredScreen`)과 계정 설정(`LoginIdSection`)이 같은 칸 · 같은 확인을 쓰도록 여기 한 곳에 둔다. 내보내지 않는다.
 */
export function LoginIdChoice({
  rules,
  api,
  onSubmit,
  onChosen,
  onAlreadySet,
  labelledBy,
  submitClassName,
  labels,
}: LoginIdChoiceProps) {
  const uid = useId()
  const fieldId = `${uid}-login-id`
  const action = useAction(labels)
  const attempt = useSubmitAttempt()
  const [value, setValue] = useState('')
  const [serverError, setServerError] = useState<string | undefined>()
  const [confirming, setConfirming] = useState(false)
  const check = useLoginIdAvailability({ api, value, rules })

  const problem = loginIdFieldError(check, rules, labels, serverError)

  function ask(event?: FormEvent) {
    event?.preventDefault()
    setServerError(undefined)
    action.clear()
    check.touch()
    if (!check.canSubmit) return attempt.fail(fieldId)
    attempt.reset()
    setConfirming(true)
  }

  async function confirm() {
    const result: { outcome?: LoginIdSubmitOutcome } = {}
    const ok = await action.run(async () => {
      try {
        await onSubmit(check.normalized)
      } catch (caught) {
        result.outcome = loginIdSubmitOutcome(caught, { value, rules, labels })
        if (result.outcome.kind === 'other') throw caught
      }
    })
    const { outcome } = result
    if (ok && !outcome) return onChosen()
    setConfirming(false) // 칸 옆 오류 · 다른 오류(429 …)는 대화상자를 닫고 화면이 말한다
    if (outcome?.kind === 'already-set') return onAlreadySet()
    if (outcome?.kind === 'field') {
      setServerError(outcome.message)
      attempt.fail(fieldId)
    }
  }

  return (
    <>
      <form onSubmit={ask} noValidate aria-labelledby={labelledBy} className={authStyles.stack}>
        {action.error && <Alert tone="danger">{action.error.message}</Alert>}
        <LoginIdField
          id={fieldId}
          value={value}
          onChange={(next) => {
            setValue(next)
            setServerError(undefined)
          }}
          check={check}
          rules={rules}
          labels={labels}
          serverError={serverError}
        />
        <FormProblems
          title={labels.formProblemsTitle}
          problems={
            attempt.attempted && problem
              ? [{ key: 'loginId', message: problem, target: fieldId }]
              : []
          }
        />
        <Button type="submit" className={submitClassName}>
          {labels.loginIdRequiredSubmit}
        </Button>
      </form>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void confirm()}
        tone="primary"
        title={labels.loginIdConfirmTitle(check.normalized)}
        description={<p>{labels.loginIdConfirmBody}</p>}
        confirmLabel={labels.loginIdConfirm}
        cancelLabel={labels.loginIdConfirmBack}
        busy={action.busy}
      />
    </>
  )
}
