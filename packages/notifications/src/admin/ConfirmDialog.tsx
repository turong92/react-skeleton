import { Alert, Button, Dialog } from '@skeleton/ui'
import type { ReactNode } from 'react'

export type ConfirmDialogProps = {
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel: string
  closeLabel: string
  loadingLabel: string
  /** 되돌릴 수 없는 일(취소 · 지우기)이면 빨간 단추 */
  danger?: boolean
  /** 확인 단추를 잠근다(예: 대상 수를 아직 못 셌다) */
  confirmDisabled?: boolean
  busy?: boolean
  error?: string | null
  onConfirm: () => void
  onClose: () => void
}

/** 되돌리기 어려운 일 앞의 확인 창 - 확인 단추를 눌러야만 `onConfirm` 이 불린다 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel,
  closeLabel,
  loadingLabel,
  danger = false,
  confirmDisabled = false,
  busy = false,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      closeLabel={closeLabel}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={confirmDisabled}
            loading={busy}
            loadingLabel={loadingLabel}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error && <Alert tone="danger">{error}</Alert>}
      {children}
    </Dialog>
  )
}
