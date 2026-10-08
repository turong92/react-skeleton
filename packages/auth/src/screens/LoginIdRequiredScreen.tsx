import { ConfirmDialog, Alert, Button, FormProblems, useSubmitAttempt } from '@skeleton/ui'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { LoginIdRules } from '../account/loginIdRules'
import type { LoginIdAvailability } from '../account/types'
import authStyles from './auth.module.css'
import { DiscardPath } from './DiscardPath'
import styles from './EmailRequiredScreen.module.css'
import { mergeLabels, type AuthLabels } from './labels'
import { loginIdFieldError } from './loginId'
import { LoginIdField } from './LoginIdField'
import { loginIdSubmitOutcome, type LoginIdSubmitOutcome } from './loginIdRequiredOutcome'
import { useAction } from './useAction'
import { useLoginIdAvailability } from './useLoginIdAvailability'

export type LoginIdRequiredScreenProps = {
  /** `GET /auth/methods` 의 `loginId` 길이 규칙 */
  rules: LoginIdRules
  /** `checkLoginId` 만 쓴다 — 실시간 확인 */
  api: { checkLoginId: (loginId: string) => Promise<LoginIdAvailability> }
  /** `POST /account/login-id { loginId }` — 정규화한 값으로 부른다. 던진 `409 LOGIN_ID_TAKEN` · 필드 오류는 칸 옆 오류가 된다 */
  onSubmit: (loginId: string) => Promise<unknown>
  /** 정했다 — 앱이 화면을 닫고 붙잡았던 호출을 다시 보낸다 */
  onChosen: () => void
  /** 서버가 `409 LOGIN_ID_ALREADY_SET` 이라 했다 — 다른 탭에서 정했다. `me` 를 다시 읽고 접는다 */
  onAlreadySet: () => void
  onSignOut: () => void
  /** 「계정 설정」 링크의 목적지(기본 `/account` — 이 경로에서는 막이 걷힌다) */
  settingsTo?: string
  /** 「이미 계정이 있나요?」 — 이메일 필수를 켠 앱의 **주소 없는 계정**에게만 준다(`DiscardPath` 의 조건 그대로). 없으면 그 조각을 그리지 않는다 */
  discard?: {
    providers: string[]
    onDiscard: () => Promise<void>
    onDiscarded: (provider?: string) => void
    onDiscardReauth?: (provider: string) => void
  }
  labels?: Partial<AuthLabels>
}

/**
 * 「아이디를 정해 주세요」 — 아이디를 켠 앱에서 아이디가 없는 계정이 앱 대신 보는 전면 화면(`LoginIdGate` 가 덮는다).
 * 아이디 칸(실시간 확인) + 채워진 단추 「이 아이디로 정하기」 하나. 누르면 **확인 대화상자**가 한 번 묻고(정한 뒤에는 바꿀 수 없다), 「정하기」로 서버에 낸다.
 * 떠나는 길은 늘 있다: 테두리 단추 「로그아웃」, 밑줄 링크 「계정 설정」, 주소 없는 계정이면 「이미 계정이 있나요?」(아이디를 태우기 전에 껍데기 계정을 치우는 길).
 */
export function LoginIdRequiredScreen({
  rules,
  api,
  onSubmit,
  onChosen,
  onAlreadySet,
  onSignOut,
  settingsTo = '/account',
  discard,
  labels: given,
}: LoginIdRequiredScreenProps) {
  const labels = mergeLabels(given)
  const uid = useId()
  const ids = { title: `${uid}-title`, loginId: `${uid}-login-id` }
  const action = useAction(labels)
  const attempt = useSubmitAttempt()
  const [value, setValue] = useState('')
  const [serverError, setServerError] = useState<string | undefined>()
  const [confirming, setConfirming] = useState(false)
  const check = useLoginIdAvailability({ api, value, rules })
  const heading = useRef<HTMLHeadingElement>(null)

  // 화면이 뜨면 제목으로(낭독이 제목 · 설명부터)
  useEffect(() => {
    heading.current?.focus()
  }, [])

  const problem = loginIdFieldError(check, rules, labels, serverError)

  function ask(event?: FormEvent) {
    event?.preventDefault()
    setServerError(undefined)
    action.clear()
    check.touch()
    if (!check.canSubmit) return attempt.fail(ids.loginId)
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
      attempt.fail(ids.loginId)
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby={ids.title}>
      <div className={styles.card}>
        <div>
          <h1 id={ids.title} ref={heading} tabIndex={-1}>
            {labels.loginIdRequiredTitle}
          </h1>
          <p className={styles.lead}>{labels.loginIdRequiredBody}</p>
        </div>
        <form onSubmit={ask} noValidate aria-labelledby={ids.title} className={authStyles.stack}>
          {action.error && <Alert tone="danger">{action.error.message}</Alert>}
          <LoginIdField
            id={ids.loginId}
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
                ? [{ key: 'loginId', message: problem, target: ids.loginId }]
                : []
            }
          />
          <Button type="submit" className={styles.submit}>
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
        {discard && (
          <DiscardPath
            labels={labels}
            providers={discard.providers}
            discard={discard.onDiscard}
            onDiscarded={discard.onDiscarded}
            onProviderReauth={discard.onDiscardReauth}
          />
        )}
        <div className={styles.leave}>
          <div className={styles.leaveActions}>
            <Button variant="secondary" onClick={onSignOut}>
              {labels.emailRequiredSignOut}
            </Button>
          </div>
          <Link className={authStyles.link} to={settingsTo}>
            {labels.loginIdRequiredSettings}
          </Link>
        </div>
      </div>
    </div>
  )
}
