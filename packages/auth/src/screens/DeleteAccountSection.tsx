import { Alert, Button, ConfirmDialog, SettingsRow } from '@skeleton/ui'
import { useState } from 'react'
import type { ReauthCredential, SocialReauth } from '../account/accountApi'
import type { DeletionResult } from '../account/types'
import { isReauthFailure, reauthKindOf, type ReauthSubject } from '../reauth/kind'
import { ReauthProof } from './ReauthProof'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'
import { SectionShell } from './SectionShell'
import { useAction } from './useAction'

export type DeleteAccountSectionProps = {
  /** 다시 인증의 종류를 고르는 `me` 의 부분(`reauthSubjectOf(me)`) */
  subject: ReauthSubject
  /** 서버의 유예 기간(`skeleton.account.deletion.grace`, 기본 30일) — 안내 문장에만 쓴다 */
  graceDays: number
  /** 서버가 self-restore 를 켰다(기본 false) — 켠 서버에서만 「다시 로그인하면 취소할 수 있어요」를 말한다 */
  selfRestore?: boolean
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
  /** 줄만 그린다(`AccountSettings` 의 카드 안) - 아니면 제목 있는 카드 한 장에 담는다 */
  row?: boolean
  labels?: Partial<AuthLabels>
}

const defaultFormat = (iso: string) => new Date(iso).toLocaleDateString()

/** 계정 삭제 절 — 다시 인증(비밀번호 · 메일 인증번호 · 제공자 동의) → 글자를 정확히 쳐야 켜지는 확인 → 유예 기간 안내 */
export function DeleteAccountSection({
  subject,
  graceDays,
  selfRestore = false,
  requestDeleteCode,
  onDelete,
  onProviderReauth,
  resume,
  onResumeSpent,
  onDeleted,
  formatDate = defaultFormat,
  row,
  labels: given,
}: DeleteAccountSectionProps) {
  const labels = mergeLabels(given)
  const kind = reauthKindOf(subject)
  const [proof, setProof] = useState<ReauthCredential | null>(null)
  // 제공자 동의에서 돌아왔으면 같은 대화상자가 그 단계(증거 확인됨 · 글자 확인만 남음)로 다시 열린다
  /** 닫을 때마다 늘어 `ReauthProof` 의 입력 · 인증번호 단계를 새로 시작하게 한다 */
  const [closed, setClosed] = useState(0)
  const [open, setOpen] = useState(() => !!resume)
  const [result, setResult] = useState<DeletionResult | null>(null)
  const del = useAction(labels)
  const credential: ReauthCredential | null = resume ? { socialReauth: resume } : proof
  const ready = credential !== null

  async function confirm() {
    if (!credential) return
    let rejected = false
    const ok = await del.run(async () => {
      try {
        setResult(await onDelete(credential))
      } catch (error) {
        rejected = isReauthFailure(error)
        throw error
      } finally {
        if (resume) onResumeSpent?.()
      }
    })
    // 증거가 거절되면 창을 열어 둔 채 그 자리에서 다시(틀린 비밀번호 · 인증번호) - 그 밖의 결과면 닫는다
    if (!ok && rejected) return
    setOpen(false)
  }

  if (result)
    return (
      <SectionShell row={row} id="delete" title={labels.sectionDelete}>
        {/* 안내를 읽을 시간을 준다 — 곧바로 로그아웃하면 가드가 로그인으로 보내 안내가 보이지 않는다 */}
        <SettingsRow
          label={labels.sectionDelete}
          action={
            <Button variant="secondary" size="sm" onClick={() => onDeleted?.(result)}>
              {labels.deleteDoneAction}
            </Button>
          }
        >
          <Alert tone="warning">
            {labels.deleteScheduled(formatDate(result.purgeAfter))}
            {selfRestore && ` ${labels.deleteSelfRestoreNote}`}
          </Alert>
        </SettingsRow>
      </SectionShell>
    )

  return (
    <SectionShell row={row} id="delete" title={labels.sectionDelete}>
      <SettingsRow
        label={labels.sectionDelete}
        action={
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              del.clear()
              setOpen(true)
            }}
          >
            {labels.deleteButton}
          </Button>
        }
        dialogs={
          <>
            <ConfirmDialog
              open={open}
              onClose={() => {
                // 취소 · Esc 뒤에는 입력한 비밀번호 · 인증번호 단계 · 실패 상태를 쥐고 있지 않는다(닫힌 대화상자도 안을 마운트해 두므로 `key` 로 새로 시작한다)
                setOpen(false)
                setProof(null)
                setClosed((n) => n + 1)
              }}
              onConfirm={confirm}
              title={labels.deleteDialogTitle}
              confirmDisabled={!ready}
              description={
                <div className={styles.stack}>
                  <p>{labels.deleteGraceNotice(graceDays)}</p>
                  <p>{labels.deleteDialogBody}</p>
                  {open && del.error && !isReauthFailure(del.raw) && (
                    <Alert tone="danger">{del.error.message}</Alert>
                  )}
                  {kind === 'password' && (
                    <p className={styles.muted}>{labels.deletePasswordHint}</p>
                  )}
                  <ReauthProof
                    key={closed}
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
                </div>
              }
              confirmLabel={labels.deleteConfirm}
              cancelLabel={labels.cancel}
              closeLabel={labels.cancel}
              busy={del.busy}
              typedConfirmation={{
                phrase: labels.deleteTypedPhrase,
                label: labels.deleteTypedLabel,
              }}
            />
          </>
        }
      >
        {del.error && !open && <Alert tone="danger">{del.error.message}</Alert>}
      </SettingsRow>
    </SectionShell>
  )
}
