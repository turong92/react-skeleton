import { useId, type HTMLAttributes, type ReactNode } from 'react'
import styles from './Card.module.css'

export type CardProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  title?: ReactNode
  actions?: ReactNode
}

export function Card({ title, actions, className, children, ...rest }: CardProps) {
  const headingId = useId()
  return (
    <section
      {...rest}
      className={[styles.card, className].filter(Boolean).join(' ')}
      aria-labelledby={title ? headingId : undefined}
    >
      {(title || actions) && (
        <header className={styles.header}>
          {title && <h2 id={headingId}>{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}
