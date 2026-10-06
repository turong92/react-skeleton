import { Alert, Button, ConfirmDialog, SectionCard } from '@skeleton/ui'
import { useState } from 'react'
import type { ReauthCredential, SocialReauth } from '../account/accountApi'
import type { DeletionResult } from '../account/types'
import { isReauthFailure, reauthKindOf, type ReauthSubject } from '../reauth/kind'
import { ReauthProof } from './ReauthProof'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'
import { useAction } from './useAction'

export type DeleteAccountSectionProps = {
  /** 다시 인증의 종류를 고르는 `me` 의 부분(`reauthSubjectOf(me)`) */
  subject: ReauthSubject
  /** 서버의 유예 기간(`skeleton.account.deletion.grace`, 기본 30일) — 안내 문장에만 쓴다 */
  graceDays: number
  /** `POST /account/delete/confirmation` — 비밀번호 없는 계정의 삭제 인증번호 메일(다시 인증 번호와 별개 · 이 세션에만 쓸 수 있다) */
  requestDeleteCode: () => Promise<unknown>
  onDelete: (credential: ReauthCredential) => Promise<DeletionResult>
  /** 주소가 없는 계정: 이 제공자의 동의를 다시 거친 뒤 돌아와 이어서 지운다(하려던 작업은 부모가 state 에 묶는다) */
  onProviderReauth?: (provider: string) => void
  /** 제공자 동의를 마치고 돌아왔다 — 그 증거. 글자를 정확히 치는 확인은 그대로 거친다 */
  resume?: SocialReauth | null
  /** 제공자 증거는 한 번만 쓰인다 — 시도한 뒤(성공 · 실패)에 부모가 버린다 */
  onResumeSpent?: () => void
  /** 삭제가 예약되고 안내를 읽은 뒤 사용자가 「로그아웃」을 눌렀을 때(보통 이 기기를 로그아웃한다) */
  onDeleted?: (result: DeletionResult) => void
  formatDate?: (iso: string) => string
  labels?: Partial<AuthLabels>
}

const defaultFormat = (iso: string) => new Date(iso).toLocaleDateString()

/** 계정 삭제 절 — 다시 인증(비밀번호 · 메일 인증번호 · 제공자 동의) → 글자를 정확히 쳐야 켜지는 확인 → 유예 기간 안내 */
export function DeleteAccountSection({
  subject,
  graceDays,
  requestDeleteCode,
  onDelete,
  onProviderReauth,
  resume,
  onResumeSpent,
  onDeleted,
  formatDate = defaultFormat,
  labels: given,
}: DeleteAccountSectionProps) {
  const labels = mergeLabels(given)
  const kind = reauthKindOf(subject)
  const [proof, setProof] = useState<ReauthCredential | null>(null)
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<DeletionResult | null>(null)
  const del = useAction(labels)
  const credential: ReauthCredential | null = resume ? { socialReauth: resume } : proof
  const ready = credential !== null

  async function confirm() {
    if (!credential) return
    await del.run(async () => {
      try {
        setResult(await onDelete(credential))
      } finally {
        if (resume) onResumeSpent?.()
      }
    })
    setOpen(false)
  }

  if (result)
    return (
      <SectionCard id="delete" title={labels.sectionDelete}>
        <div className={styles.stack}>
          <Alert tone="warning">{labels.deleteScheduled(formatDate(result.purgeAfter))}</Alert>
          {/* 안내를 읽을 시간을 준다 — 곧바로 로그아웃하면 가드가 로그인으로 보내 안내가 보이지 않는다 */}
          <div>
            <Button onClick={() => onDeleted?.(result)}>{labels.deleteDoneAction}</Button>
          </div>
        </div>
      </SectionCard>
    )

  return (
    <SectionCard
      id="delete"
      title={labels.sectionDelete}
      description={labels.deleteGraceNotice(graceDays)}
    >
      <div className={styles.stack}>
        {del.error && !isReauthFailure(del.raw) && <Alert tone="danger">{del.error.message}</Alert>}
        {kind === 'password' && <p className={styles.muted}>{labels.deletePasswordHint}</p>}
        <ReauthProof
          kind={kind}
          email={subject.email}
          providers={subject.providers}
          requestCode={requestDeleteCode}
          onChange={setProof}
          failure={isReauthFailure(del.raw) ? del.raw : undefined}
          onProvider={onProviderReauth}
          confirmedWith={resume?.provider}
          labels={given}
        />
        <div>
          <Button variant="danger" disabled={!ready} onClick={() => setOpen(true)}>
            {labels.deleteButton}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        title={labels.deleteDialogTitle}
        description={labels.deleteDialogBody}
        confirmLabel={labels.deleteConfirm}
        cancelLabel={labels.cancel}
        closeLabel={labels.cancel}
        busy={del.busy}
        typedConfirmation={{ phrase: labels.deleteTypedPhrase, label: labels.deleteTypedLabel }}
      />
    </SectionCard>
  )
}
