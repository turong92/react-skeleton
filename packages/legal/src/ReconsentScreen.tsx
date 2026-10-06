import { Alert, Button } from '@skeleton/ui'
import { useId, useState } from 'react'
import { ConsentChecklist } from './ConsentChecklist'
import { consentRequestsOf, type ConsentRow } from './consentLogic'
import { mergeLegalLabels, type LegalLabels } from './labels'
import styles from './ReconsentScreen.module.css'
import type { ConsentRequest } from './types'

export type ReconsentScreenProps = {
  /** 동의해야 하는 줄 — 서버가 말한 `missing`(`rowsFromMissing`) */
  rows: readonly ConsentRow[]
  /** `true`: 로그인 직후(처음 동의) · `false`: 쓰다가 약관이 바뀌었다 — 안내 문구가 다르다 */
  firstSignIn?: boolean
  /** 동의 요청을 보낸다 — 실패는 던진다(화면이 문구로 바꾼다) */
  onAgree: (consents: ConsentRequest[]) => Promise<void>
  /** 동의하지 않고 떠난다(보통 로그아웃) */
  onLeave: () => void
  onOpen?: (row: ConsentRow) => void
  /** 직전 시도의 실패 — `stale` 이면 그 사이 새 판이 나왔다 */
  failure?: 'stale' | 'failed' | null
  labels?: Partial<LegalLabels>
}

/**
 * 동의 화면(재동의 · 첫 로그인 동의) — 한 화면을 덮는 막이다(`role="dialog"` · 뒤는 `inert`는 `ReconsentGate` 가).
 * 필수 줄이 모두 체크돼야 「동의하고 계속하기」가 된다. 같은 화면이 가입 직후 · 소셜 첫 로그인 · 새 판 모두를 맡는다.
 */
export function ReconsentScreen({
  rows,
  firstSignIn,
  onAgree,
  onLeave,
  onOpen,
  failure,
  labels: given,
}: ReconsentScreenProps) {
  const labels = mergeLegalLabels(given)
  const titleId = useId()
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [showError, setShowError] = useState(false)
  const complete = rows.every((r) => checked[r.type])

  async function submit() {
    if (!complete) return setShowError(true)
    setBusy(true)
    try {
      await onAgree(consentRequestsOf(rows, checked))
    } catch {
      // 실패 문구는 부모가 `failure` 로 준다
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className={styles.card}>
        <h1 id={titleId}>{labels.reconsentTitle}</h1>
        <p>{firstSignIn ? labels.reconsentBodyFirstSignIn : labels.reconsentBody}</p>
        {failure === 'stale' && <Alert tone="warning">{labels.reconsentStale}</Alert>}
        {failure === 'failed' && <Alert tone="danger">{labels.reconsentFailed}</Alert>}
        <ConsentChecklist
          rows={rows}
          checked={checked}
          onChange={(next) => {
            setChecked(next)
            setShowError(false)
          }}
          onOpen={onOpen}
          showError={showError}
          labels={given}
        />
        <div className={styles.actions}>
          <Button onClick={() => void submit()} loading={busy} loadingLabel={labels.submitting}>
            {labels.reconsentSubmit}
          </Button>
          <Button variant="ghost" onClick={onLeave}>
            {labels.reconsentLeave}
          </Button>
        </div>
      </div>
    </div>
  )
}
