import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import styles from './RowMenu.module.css'

export type RowMenuItem = {
  key: string
  label: string
  onSelect: () => void
  /** 되돌릴 수 없는 동작 — 위험 색 */
  danger?: boolean
  /** 포커스는 받지만 실행되지 않는다(`aria-disabled`) */
  disabled?: boolean
  /** 있으면 하나 고르기 항목(`menuitemradio` + `aria-checked`) — 고른 것 앞에 ✓ */
  checked?: boolean
  /** 앞에 구분선 */
  separatorBefore?: boolean
}

export type RowMenuProps = {
  /** 버튼 이름 — 줄을 가리키는 말을 넣는다(예 「Ada 더보기」) */
  label: string
  items: RowMenuItem[]
  /** 잠금 — 버튼은 `aria-disabled` 로 포커스를 받은 채 열리지 않는다. 열려 있던 메뉴는 닫힌다 */
  disabled?: boolean
  /** 버튼 안(기본 ⋯). 글자가 보여도 이름은 `label` 이다 */
  trigger?: ReactNode
  /** 메뉴를 버튼의 어느 쪽 끝에 맞출까(기본 `end`) — 화면 밖으로 넘치면 반대쪽으로 맞춘다 */
  align?: 'start' | 'end'
  className?: string
}

/** 열 때 포커스할 항목 — ↑ 로 열면 마지막(APG 메뉴 버튼) */
type OpenAt = 'first' | 'last'

/**
 * 목록 줄의 ⋯ 메뉴 — WAI-ARIA 메뉴 버튼. 열면 첫 항목(↑ 로 열면 마지막)에 포커스, ↑↓ Home End 로 옮기고(끝에서 돈다)
 * Esc · 항목 고르기는 닫고 버튼으로 포커스, Tab 은 메뉴를 벗어나며 닫고(포커스는 다음 요소로), 바깥을 누르면 닫는다. 아래 자리가 모자라면 위로(`data-placement="top"`), 끝 정렬이 화면 밖으로 넘치면 시작 정렬로(`data-align="start"`) 연다.
 */
export function RowMenu({
  label,
  items,
  disabled,
  trigger,
  align = 'end',
  className,
}: RowMenuProps) {
  const [openAt, setOpenAt] = useState<OpenAt | null>(null)
  const open = openAt !== null && !disabled
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  // 메뉴 안에 포커스가 있던 채 닫히면(잠금 등) 버튼으로 돌린다 — body 로 떨어지지 않게
  const focusInside = useRef(false)
  const buttonId = useId()
  const menuId = useId()

  useLayoutEffect(() => {
    const menu = menuRef.current
    const button = buttonRef.current
    if (!open || !menu || !button) return
    const anchor = button.getBoundingClientRect()
    const below = window.innerHeight - anchor.bottom
    const needed = menu.getBoundingClientRect().height
    menu.dataset.placement = needed > below && anchor.top > below ? 'top' : 'bottom'
    // 원하는 쪽(기본 끝)에 맞추고, 그쪽 화면 밖으로 넘치면 반대로 맞춘다(왼쪽 끝 버튼의 메뉴가 잘리지 않게)
    menu.dataset.align = align
    const box = menu.getBoundingClientRect()
    if (box.left < 0 || box.right > window.innerWidth)
      menu.dataset.align = align === 'end' ? 'start' : 'end'
  }, [open, align])

  useEffect(() => {
    if (!open) {
      if (focusInside.current) {
        focusInside.current = false
        buttonRef.current?.focus()
      }
      return
    }
    const nodes = itemRefs.current.filter((node): node is HTMLButtonElement => node !== null)
    ;(openAt === 'last' ? nodes.at(-1) : nodes[0])?.focus()
    focusInside.current = true
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return
      focusInside.current = false // 바깥을 누른 곳이 포커스를 가져간다
      setOpenAt(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, openAt])

  function close() {
    focusInside.current = false
    setOpenAt(null)
    buttonRef.current?.focus()
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const nodes = itemRefs.current.filter((node): node is HTMLButtonElement => node !== null)
    const at = nodes.findIndex((node) => node === document.activeElement)
    const last = nodes.length - 1
    const target: Record<string, number> = {
      ArrowDown: at >= last ? 0 : at + 1,
      ArrowUp: at <= 0 ? last : at - 1,
      Home: 0,
      End: last,
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key in target) {
      event.preventDefault()
      nodes[target[event.key]]?.focus()
    }
  }

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(' ')}
      onBlur={(event) => {
        // Tab 으로 메뉴 밖의 다른 요소로 나가면 닫는다(포커스는 이미 그쪽). 가는 곳이 없으면(null) 두고 Esc · 바깥 누르기에 맡긴다 —
        // 일부 브라우저는 버튼을 눌러도 포커스를 안 줘 null 이 오는데, 그때 닫으면 항목 클릭이 사라진다
        const to = event.relatedTarget
        if (to instanceof Node && !event.currentTarget.contains(to)) {
          focusInside.current = false
          setOpenAt(null)
        }
      }}
    >
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        className={styles.button}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-disabled={disabled ? true : undefined}
        onClick={() => {
          if (!disabled) setOpenAt(open ? null : 'first')
        }}
        onKeyDown={(event) => {
          if (disabled || open) return
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpenAt(event.key === 'ArrowUp' ? 'last' : 'first')
          }
        }}
      >
        {trigger ?? <span aria-hidden="true">⋯</span>}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={buttonId}
          className={styles.menu}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item, index) => (
            <div key={item.key} className={styles.entry}>
              {item.separatorBefore && <div role="separator" className={styles.separator} />}
              <button
                ref={(node) => {
                  itemRefs.current[index] = node
                }}
                type="button"
                role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                aria-checked={item.checked}
                aria-disabled={item.disabled ? true : undefined}
                tabIndex={-1}
                className={styles.item}
                data-danger={item.danger ? 'true' : undefined}
                onClick={() => {
                  if (item.disabled) return
                  // 먼저 닫고 버튼으로 포커스 — onSelect 가 대화상자를 열면 그 창이 포커스를 가져간다
                  close()
                  item.onSelect()
                }}
              >
                <span className={styles.check} aria-hidden="true">
                  {item.checked ? '✓' : ''}
                </span>
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
