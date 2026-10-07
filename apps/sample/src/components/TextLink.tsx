import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import styles from './TextLink.module.css'

/**
 * 표 · 목록 안의 **글자 링크**(글 · 노트 제목, 「모두 보기」) — 밑줄 + 굵은 글씨로 쉬는 상태에서도 눌리는 것으로 보인다(글자만 있는 눌림 요소 금지 — `docs/ui-catalog.md` 맨 위 원칙).
 * 줄 전체가 눌리는 큰 진입은 `LinkCard`, 버튼 모양의 이동은 `LinkButton`
 */
export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={styles.link}>
      {children}
    </Link>
  )
}
