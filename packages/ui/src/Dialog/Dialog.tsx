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
  /** 가장 최근 렌더의 `onClose` - 효과가 낡은 것을 부르지 않게 */
  const onCloseRef = useRef(onClose)
  /** 우리가 `open={false}` 때문에 `close()` 를 부른 뒤 아직 오지 않은 `close` 이벤트가 있다 */
  const closedByProp = useRef(false)
  /** 닫기 버튼이 이미 `onClose` 를 불렀다 - 뒤따르는 프로그램의 닫기가 한 번 더 부르지 않게 */
  const notifiedByButton = useRef(false)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      openerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      notifiedByButton.current = false
      dialog.showModal()
    }
    if (!open && dialog.open) {
      // 부모가 닫았다(`open={false}`): 정리(`onClose`)는 **지금** 한 번 알린다 - 닫기 버튼이 이미 알렸으면 건너뛴다.
      // 뒤늦게 오는 `close` 이벤트로 알리지 않는다: 그 사이 부모가 다시 열려고 `open` 을 켰다면 그 이벤트의 `onClose()` 가 새 열기를 되돌려 창이 다시 열리지 않는다
      // 부모 콜백은 창을 닫고 포커스를 돌려준 **뒤 마지막에** 부른다 - 콜백이 던져도 창은 닫힌다
      closedByProp.current = true
      const notify = !notifiedByButton.current
      notifiedByButton.current = false
      dialog.close()
      // 브라우저가 연 곳으로 포커스를 돌려주지만(창이 포커스를 잃었을 때 등) 늘 그렇지는 않다 — 직접 돌려준다
      const opener = openerRef.current
      openerRef.current = null
      if (opener?.isConnected && document.activeElement !== opener) opener.focus()
      if (notify) onCloseRef.current()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={() => {
        // 우리가 닫은 것의 늦은 `close` 이벤트 - 정리는 이미 알렸다
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
        <button
          type="button"
          className={styles.close}
          aria-label={closeLabel}
          onClick={() => {
            notifiedByButton.current = true
            onClose()
          }}
        >
          ×
        </button>
      </div>
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </dialog>
  )
}
