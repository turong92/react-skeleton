import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { nextTabId } from './tabKeys'
import styles from './Tabs.module.css'

export type TabItem = {
  id: string
  label: ReactNode
  content: ReactNode
  disabled?: boolean
}

export type TabsProps = {
  items: TabItem[]
  /** 제어: 고른 탭 id(`onValueChange` 와 함께) */
  value?: string
  /** 비제어: 처음에 고를 탭(없으면 첫 활성 탭) */
  defaultValue?: string
  onValueChange?: (id: string) => void
  orientation?: 'horizontal' | 'vertical'
  /** 탭 목록의 이름 — 둘 중 하나는 있어야 한다 */
  'aria-label'?: string
  'aria-labelledby'?: string
}

/**
 * WAI-ARIA tabs — `role=tablist/tab/tabpanel`, 선택된 탭만 Tab 키 순서에 들어가고(roving tabindex) 화살표 · Home · End 로 옮긴다.
 * 포커스를 옮기면 바로 선택된다(자동 활성). 모든 패널은 마운트된 채 선택되지 않은 것은 `hidden`.
 */
export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  orientation = 'horizontal',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
}: TabsProps) {
  const base = useId()
  const [inner, setInner] = useState(defaultValue)
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const firstEnabled = items.find((item) => !item.disabled)?.id
  const selected = value ?? inner ?? firstEnabled

  const select = (id: string) => {
    if (value === undefined) setInner(id)
    onValueChange?.(id)
  }

  const onKeyDown = (id: string) => (event: KeyboardEvent) => {
    const next = nextTabId(items, id, event.key, orientation)
    if (next === null) return
    event.preventDefault()
    select(next)
    refs.current.get(next)?.focus()
  }

  return (
    <div className={styles.tabs} data-orientation={orientation}>
      <div
        role="tablist"
        aria-orientation={orientation}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        className={styles.list}
      >
        {items.map((item) => (
          <button
            key={item.id}
            ref={(element) => {
              if (element) refs.current.set(item.id, element)
              else refs.current.delete(item.id)
            }}
            id={`${base}-tab-${item.id}`}
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={item.id === selected}
            aria-controls={`${base}-panel-${item.id}`}
            tabIndex={item.id === selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => select(item.id)}
            onKeyDown={onKeyDown(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          id={`${base}-panel-${item.id}`}
          role="tabpanel"
          className={styles.panel}
          aria-labelledby={`${base}-tab-${item.id}`}
          hidden={item.id !== selected}
        >
          {item.content}
        </div>
      ))}
    </div>
  )
}
