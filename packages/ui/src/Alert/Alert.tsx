import type { ReactNode } from 'react'
import styles from './Alert.module.css'

export type AlertProps = {
  tone?: 'info' | 'success' | 'warning' | 'danger'
  title?: string
  children: ReactNode
  /** 오른쪽(좁으면 아래)에 놓는 동작 — 링크 · 버튼 */
  action?: ReactNode
  /** 있으면 닫기 버튼이 생긴다(부모가 사라지게 한다) */
  onDismiss?: () => void
  /** 닫기 버튼 이름(기본 `Dismiss`) */
  dismissLabel?: string
  /** 색에만 기대지 않게 낭독되는 말머리(기본 `Info` · `Success` · `Warning` · `Error`) */
  toneLabel?: string
}

const DEFAULT_TONE_LABEL = {
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  danger: 'Error',
} as const

/** 문서 안에 박히는 안내 · 경고 띠(토스트와 달리 사라지지 않는다). 위험 · 경고는 `role="alert"`, 나머지는 `role="status"` */
export function Alert({
  tone = 'info',
  title,
  children,
  action,
  onDismiss,
  dismissLabel = 'Dismiss',
  toneLabel,
}: AlertProps) {
  const urgent = tone === 'danger' || tone === 'warning'
  return (
    <div className={styles.alert} data-tone={tone} role={urgent ? 'alert' : 'status'}>
      <span className={styles.srOnly}>{toneLabel ?? DEFAULT_TONE_LABEL[tone]}</span>
      <div className={styles.body}>
        {title && <strong className={styles.title}>{title}</strong>}
        <div className={styles.text}>{children}</div>
      </div>
      {action && <div className={styles.action}>{action}</div>}
      {onDismiss && (
        <button
          type="button"
          className={styles.dismiss}
          aria-label={dismissLabel}
          onClick={onDismiss}
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  )
}
