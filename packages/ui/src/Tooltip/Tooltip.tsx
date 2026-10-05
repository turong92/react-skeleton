import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import styles from './Tooltip.module.css'

export type TooltipTriggerProps = { 'aria-describedby': string }

export type TooltipProps = {
  /** 보조 설명(짧은 글자) — 이것이 유일한 안내이면 안 된다(터치에는 없다) */
  content: string
  /** `Field` 처럼 속성을 받아 펼친다: `{(aria) => <Button {...aria}>…</Button>}` */
  children: (aria: TooltipTriggerProps) => ReactNode
  placement?: 'top' | 'bottom'
  /** 올려 둔 뒤 보이기까지(ms, 기본 400). 키보드 포커스는 바로 보인다 */
  delayMs?: number
}

/**
 * 도움말 말풍선 — WAI-ARIA tooltip. 트리거에 `aria-describedby` 로 이어지고, 마우스를 올리거나 포커스하면 보이며 Esc 로 닫는다.
 * 말풍선 자신은 포커스를 받지 않는다. 말풍선에 마우스를 올려도 닫히지 않는다(WCAG 1.4.13).
 */
export function Tooltip({ content, children, placement = 'top', delayMs = 400 }: TooltipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  function show(delay: number) {
    clearTimeout(timer.current)
    if (delay <= 0) setOpen(true)
    else timer.current = setTimeout(() => setOpen(true), delay)
  }
  function hide() {
    clearTimeout(timer.current)
    setOpen(false)
  }

  return (
    <span
      className={styles.root}
      onMouseEnter={() => show(delayMs)}
      onMouseLeave={hide}
      onFocus={() => show(0)}
      onBlur={hide}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          hide()
        }
      }}
    >
      {children({ 'aria-describedby': id })}
      <span
        id={id}
        role="tooltip"
        className={styles.tip}
        data-placement={placement}
        data-open={open ? 'true' : 'false'}
        hidden={!open}
      >
        {content}
      </span>
    </span>
  )
}
