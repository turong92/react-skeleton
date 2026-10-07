import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import styles from './LinkCard.module.css'

/**
 * 줄 전체가 눌리는 **링크 카드** — 테두리 · 오른쪽 화살표 · hover/focus 가 있어 한눈에 눌리는 것으로 보인다(글자만 있는 링크 금지 — `docs/ui-catalog.md` 맨 위 원칙).
 * 어딘가 **다른 화면으로 가는** 큰 진입(계정 관리 …)에 쓴다. 한 문장 안의 링크는 밑줄 + 링크색 `<a>`, 같은 구역의 행동은 `Button`
 */
export function LinkCard({
  to,
  description,
  children,
}: {
  to: string
  /** 그 뒤에 무엇이 있는지 한 줄 — 같은 링크 안에 있어 낭독도 이어서 읽는다 */
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <Link to={to} className={styles.card}>
      <span className={styles.text}>
        <strong className={styles.title}>{children}</strong>
        {description && <span className={styles.description}>{description}</span>}
      </span>
      <span className={styles.arrow} aria-hidden="true">
        →
      </span>
    </Link>
  )
}
