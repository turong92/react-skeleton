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
  /** `open` 이 꺼져서 우리가 `close()` 를 부른 뒤 아직 오지 않은 `close` 이벤트가 있다 - 그 이벤트는 부모에게 알릴 사용자의 닫기가 아니다 */
  const closedByProp = useRef(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      openerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      dialog.showModal()
    }
    if (!open && dialog.open) {
      closedByProp.current = true
      dialog.close()
      // 브라우저가 연 곳으로 포커스를 돌려주지만(창이 포커스를 잃었을 때 등) 늘 그렇지는 않다 — 직접 돌려준다
      const opener = openerRef.current
      openerRef.current = null
      if (opener?.isConnected && document.activeElement !== opener) opener.focus()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={() => {
        // 우리가 `open={false}` 때문에 닫은 것의 늦은 `close` 이벤트다 - 부모는 이미 닫힌 줄 안다. 그 사이 부모가 다시 열려고 `open` 을 켰다면(아직 `showModal` 전)
        // 이 이벤트로 `onClose()` 를 부르면 그 새 열기를 되돌려 창이 다시 열리지 않는다
        if (closedByProp.current) {
          closedByProp.current = false
          return
        }
        // `close` 이벤트는 비동기로 온다 - 닫자마자 다시 열었다면 앞선 닫기의 늦은 이벤트다. 지금 열려 있는 창을 닫으면 안 된다
        if (!ref.current?.open) onClose()
      }}
    >
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
