import { useEffect, useId, useRef, type ReactNode } from 'react'
import styles from './Dialog.module.css'

export type DialogProps = {
  open: boolean
  /** 닫기 버튼 · Esc 로 닫힐 때 — 열림 상태는 부모가 쥔다 */
  onClose: () => void
  title: string
  /** 닫기 버튼 이름(기본 `Close`) */
  closeLabel?: string
  footer?: ReactNode
  children: ReactNode
}

/** 네이티브 `<dialog>` 모달 — 포커스 가두기 · Esc · 배경 막기를 브라우저가 한다 */
export function Dialog({
  open,
  onClose,
  title,
  closeLabel = 'Close',
  footer,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={ref} className={styles.dialog} aria-labelledby={titleId} onClose={onClose}>
      <header className={styles.header}>
        <h2 id={titleId}>{title}</h2>
        <button type="button" className={styles.close} aria-label={closeLabel} onClick={onClose}>
          ×
        </button>
      </header>
      <div className={styles.body}>{children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </dialog>
  )
}
