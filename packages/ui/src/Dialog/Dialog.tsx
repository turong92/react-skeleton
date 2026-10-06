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
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      openerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      dialog.showModal()
    }
    if (!open && dialog.open) {
      dialog.close()
      // 브라우저가 연 곳으로 포커스를 돌려주지만(창이 포커스를 잃었을 때 등) 늘 그렇지는 않다 — 직접 돌려준다
      const opener = openerRef.current
      openerRef.current = null
      if (opener?.isConnected && document.activeElement !== opener) opener.focus()
    }
  }, [open])

  return (
    <dialog ref={ref} className={styles.dialog} aria-labelledby={titleId} onClose={onClose}>
      <div className={styles.header}>
        <h2 id={titleId}>{title}</h2>
        <button type="button" className={styles.close} aria-label={closeLabel} onClick={onClose}>
          ×
        </button>
      </div>
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </dialog>
  )
}
