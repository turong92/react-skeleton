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
  /**
   * 기본 true. `false` 면 × 버튼이 없고 Esc 로도 닫히지 않는다(브라우저가 cancel 을 건너뛰고 닫아도 다시 모달로 연다) - 닫기는 부모가 `open` 을 끄는 것뿐.
   * 다 읽기 전에 닫히면 안 되는 창(한 번만 보이는 복구 코드)에만 쓴다
   */
  dismissible?: boolean
  /**
   * 화면 전체를 덮는 창. 제목 줄 · × 를 그리지 않는다 — 제목은 보이지 않는 `h2` 로 창 이름만 되고 닫기는 내용이 둔다.
   * Esc → `onClose` 는 그대로(`dismissible` 규칙도 그대로). `footer` 는 쓰지 않는다 — 아래 줄도 내용이 둔다
   */
  fullScreen?: boolean
  /**
   * 창이 놓이는 곳 — 기본 `center`(가운데). `left` · `right` · `bottom` 은 그쪽 가장자리에 붙은 판이 transform 으로 밀려 들어오고 나간다(모션 감소면 바로). `Drawer` 가 이걸 쓴다
   */
  placement?: 'center' | 'left' | 'right' | 'bottom'
  children: ReactNode
}

/** 포인터 좌표가 요소 상자 밖인가 */
function isOutside(point: { clientX: number; clientY: number }, element: HTMLElement) {
  const box = element.getBoundingClientRect()
  return (
    point.clientX < box.left ||
    point.clientX > box.right ||
    point.clientY < box.top ||
    point.clientY > box.bottom
  )
}

/** 네이티브 `<dialog>` 모달 —포커스 가두기 · Esc · 배경 막기를 브라우저가 한다 */
export function Dialog({
  open,
  onClose,
  title,
  closeLabel = 'Close',
  footer,
  dismissible = true,
  fullScreen = false,
  placement = 'center',
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
  /** 이번 누르기가 판 바깥에서 시작했다 */
  const pressedOutside = useRef(false)

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
      data-fullscreen={fullScreen || undefined}
      data-placement={placement === 'center' ? undefined : placement}
      onPointerDown={(event) => {
        // 덮개를 누르면 대상이 `<dialog>` 자신이다 — 안쪽 요소를 누른 것(좌표가 없는 합성 입력 포함)은 바깥이 아니다
        pressedOutside.current =
          placement !== 'center' &&
          event.target === event.currentTarget &&
          isOutside(event, event.currentTarget)
      }}
      onClick={(event) => {
        // 판(Drawer)은 바깥(덮개)을 누르면 닫힌다. 덮개를 누르면 대상이 `<dialog>` 자신이지만 판 안의 빈 곳도 그렇다 — 대상이 아니라 **좌표**가 판 밖이고,
        // 누르기를 시작한 곳도 판 밖일 때만(안에서 끌다가 밖에서 뗀 것은 닫지 않는다). 가운데 창은 그대로(닫기 버튼 · Esc)
        const closes =
          placement !== 'center' &&
          dismissible &&
          pressedOutside.current &&
          event.target === event.currentTarget &&
          isOutside(event, event.currentTarget)
        pressedOutside.current = false
        if (closes) {
          notifiedByButton.current = true
          onClose()
        }
      }}
      onCancel={(event) => {
        if (!dismissible) event.preventDefault() // Esc
      }}
      onClose={() => {
        // 우리가 닫은 것의 늦은 `close` 이벤트 - 정리는 이미 알렸다
        if (closedByProp.current) {
          closedByProp.current = false
          return
        }
        // `close` 이벤트는 비동기로 온다 - 닫자마자 다시 열었다면 앞선 닫기의 늦은 이벤트다. 지금 열려 있는 창을 닫으면 안 된다
        if (!ref.current?.open) {
          // 닫히면 안 되는 창인데 닫혔다(Esc 를 연달아 누르면 브라우저가 cancel 을 건너뛴다) - 다시 모달로 연다
          if (!dismissible) ref.current?.showModal()
          else onClose()
        }
      }}
    >
      {fullScreen ? (
        <h2 id={titleId} className={styles.nameOnly}>
          {title}
        </h2>
      ) : (
        <div className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          {dismissible && (
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
          )}
        </div>
      )}
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </dialog>
  )
}
