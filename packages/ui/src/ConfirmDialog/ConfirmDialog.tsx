import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Button } from '../Button/Button'
import { Dialog } from '../Dialog/Dialog'
import { Field } from '../Field/Field'
import { Input } from '../Input/Input'
import styles from './ConfirmDialog.module.css'
import { isConfirmed } from './isConfirmed'

export type ConfirmDialogProps = {
  open: boolean
  /** 취소 · × · Esc — 열림 상태는 부모가 쥔다 */
  onClose: () => void
  /** 확인을 눌렀을 때(문구를 맞게 쳤을 때만). 닫는 것은 부모의 몫 — 일하는 동안은 `busy` */
  onConfirm: () => void
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  closeLabel?: string
  /** 되돌릴 수 없으면 `danger`(기본) */
  tone?: 'danger' | 'primary'
  /** 일하는 중 — 두 버튼이 잠기고 확인에 스피너 */
  busy?: boolean
  /** 있으면 이 문구를 정확히 쳐야 확인이 켜진다(프로젝트 · 계정 삭제처럼 실수가 큰 동작) */
  typedConfirmation?: { phrase: string; label: string; hint?: string }
}

type BodyProps = Pick<ConfirmDialogProps, 'description' | 'typedConfirmation'> & {
  formId: string
  anchorRef: RefObject<HTMLDivElement | null>
  typed: string
  onTyped: (value: string) => void
  onSubmit: () => void
}

function Body({
  description,
  typedConfirmation,
  formId,
  anchorRef,
  typed,
  onTyped,
  onSubmit,
}: BodyProps) {
  return (
    <div className={styles.body} ref={anchorRef}>
      {description && <div className={styles.description}>{description}</div>}
      {typedConfirmation && (
        <form
          id={formId}
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <Field label={typedConfirmation.label} hint={typedConfirmation.hint}>
            {(control) => (
              <Input
                {...control}
                value={typed}
                onChange={(event) => onTyped(event.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            )}
          </Field>
        </form>
      )}
    </div>
  )
}

/**
 * 되돌릴 수 없는 동작 앞의 확인 창 — `Dialog` 위에. 처음 포커스는 입력칸(문구를 치는 경우) 아니면 「취소」(실수로 Enter 를 눌러도 안전한 쪽).
 * `typedConfirmation` 이면 문구가 맞아야 확인이 켜지고, 입력칸에서 Enter 로도 확인한다. 열 때마다 입력은 비워진다.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  closeLabel,
  tone = 'danger',
  busy = false,
  typedConfirmation,
}: ConfirmDialogProps) {
  const formId = useId()
  const [typed, setTyped] = useState('')
  const anchorRef = useRef<HTMLDivElement>(null)
  const ready = isConfirmed(typedConfirmation?.phrase, typed) && !busy

  // `Dialog` 의 효과(showModal)가 먼저 돈 뒤 — 안전한 곳으로 포커스
  useEffect(() => {
    if (!open) return
    const dialog = anchorRef.current?.closest('dialog')
    ;(
      dialog?.querySelector<HTMLElement>('input') ??
      dialog?.querySelector<HTMLElement>('[data-cancel]')
    )?.focus()
  }, [open])

  function confirm() {
    if (ready) onConfirm()
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        setTyped('')
        onClose()
      }}
      title={title}
      closeLabel={closeLabel}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy} data-cancel="">
            {cancelLabel}
          </Button>
          <Button
            variant={tone}
            loading={busy}
            disabled={!ready && !busy}
            form={typedConfirmation ? formId : undefined}
            type={typedConfirmation ? 'submit' : 'button'}
            onClick={typedConfirmation ? undefined : confirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Body
        description={description}
        typedConfirmation={typedConfirmation}
        formId={formId}
        anchorRef={anchorRef}
        typed={typed}
        onTyped={setTyped}
        onSubmit={confirm}
      />
    </Dialog>
  )
}
