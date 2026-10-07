import type { RowMenuItem } from './RowMenu'
import styles from './RowMenu.module.css'

/** 메뉴의 한 항목 — 구분선(앞) + 메뉴 항목 단추. 잠긴 항목은 포커스는 받되 실행되지 않는다 */
export function RowMenuEntry({
  item,
  register,
  onPick,
}: {
  item: RowMenuItem
  register: (node: HTMLButtonElement | null) => void
  onPick: () => void
}) {
  return (
    <div className={styles.entry}>
      {item.separatorBefore && <div role="separator" className={styles.separator} />}
      <button
        ref={register}
        type="button"
        role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
        aria-checked={item.checked}
        aria-disabled={item.disabled ? true : undefined}
        aria-label={item.content === undefined ? undefined : item.label}
        tabIndex={-1}
        className={styles.item}
        data-danger={item.danger ? 'true' : undefined}
        onClick={() => {
          if (!item.disabled) onPick()
        }}
      >
        <span className={styles.check} aria-hidden="true">
          {item.checked ? '✓' : ''}
        </span>
        <span className={styles.itemLabel}>{item.content ?? item.label}</span>
      </button>
    </div>
  )
}
