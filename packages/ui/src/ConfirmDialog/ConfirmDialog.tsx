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
  /** 일하는 동안 확인 버튼의 스피너를 읽는 이름(기본 `Loading`) — 한국어 화면이면 한국어로 */
  loadingLabel?: string
  /** 있으면 이 문구를 정확히 쳐야 확인이 켜진다(프로젝트 · 계정 삭제처럼 실수가 큰 동작) */
  typedConfirmation?: { phrase: string; label: string; hint?: string }
  /** true 면 확인이 꺼져 있다 — 창이 요구하는 다른 것(다시 인증 · 동의)이 아직 준비되지 않았을 때 */
  confirmDisabled?: boolean
  /**
   * 막혔지만 닿는 확인 — 창 안에서 **왜 못 누르는지 말하는 요소의 id**. 있으면 확인이 `aria-disabled="true"`(흐리게)로 남고,
   * Tab 으로 닿고, 눌러도 아무 일 없고(제출도 하지 않는다), 그 요소가 단추 설명(`aria-describedby`)으로 낭독된다.
   * 꺼진(`disabled`) 단추는 키보드 · 터치로 이유에 닿지 못한다 — `disabled` 는 `busy`(정말 일하는 중)에만. `confirmDisabled` 보다 우선한다
   */
  confirmBlockedBy?: string
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
  loadingLabel,
  typedConfirmation,
  confirmDisabled = false,
  confirmBlockedBy,
}: ConfirmDialogProps) {
  const formId = useId()
  const [typed, setTyped] = useState('')
  const anchorRef = useRef<HTMLDivElement>(null)
  const blocked = confirmBlockedBy !== undefined && !busy
  const ready =
    isConfirmed(typedConfirmation?.phrase, typed) && !busy && !confirmDisabled && !blocked

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
            loadingLabel={loadingLabel}
            disabled={!blocked && (confirmDisabled || (!ready && !busy))}
            aria-disabled={blocked ? true : undefined}
            aria-describedby={blocked ? confirmBlockedBy : undefined}
            form={typedConfirmation && !blocked ? formId : undefined}
            type={typedConfirmation && !blocked ? 'submit' : 'button'}
            onClick={typedConfirmation || blocked ? undefined : confirm}
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
