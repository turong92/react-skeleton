import type { CSSProperties } from 'react'
import styles from './Skeleton.module.css'

export type SkeletonProps = {
  shape?: 'text' | 'rect' | 'circle'
  /** 글 줄 수(`shape="text"`) — 마지막 줄은 짧게 */
  lines?: number
  /** CSS 길이(`3rem` · `100%`) — 모양이 정해진 자리표시에 */
  width?: string
  height?: string
  /** 낭독 이름(기본 `Loading`) — 모양은 낭독에서 빠지고 이 글자 하나만 읽힌다 */
  label?: string
}

/** 로딩 자리표시 — 내용이 올 자리의 모양을 미리 잡아 화면이 튀지 않게 한다(움직임 줄이기 설정을 따른다) */
export function Skeleton({
  shape = 'text',
  lines = 1,
  width,
  height,
  label = 'Loading',
}: SkeletonProps) {
  const count = shape === 'text' ? Math.max(1, lines) : 1
  const style: CSSProperties = { width, height }
  return (
    <div className={styles.root} role="status" aria-busy="true">
      <span className={styles.srOnly}>{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={styles.bar}
          data-shape={shape}
          data-last={shape === 'text' && count > 1 && index === count - 1 ? 'true' : undefined}
          style={style}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}
