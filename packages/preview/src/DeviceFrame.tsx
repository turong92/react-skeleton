import type { CSSProperties, ReactNode } from 'react'
import { frameInsets, type FrameKind } from './frame'
import styles from './DeviceFrame.module.css'

export type DeviceFrameProps = {
  kind: FrameKind
  /** 화면(CSS 뷰포트) 크기 — 바깥 상자 = 화면 + frameInsets */
  screen: { width: number; height: number }
  /** 부르는 쪽의 transform 만(배율) — 동적 값 */
  style?: Pick<CSSProperties, 'transform'>
  children: ReactNode
}

/** 기기 틀 — 바깥 상자(베젤 · 그림자 · data-kind) > 화면 상자(overflow hidden · 화면 반경) > children */
export function DeviceFrame({ kind, screen, style, children }: DeviceFrameProps) {
  const insets = frameInsets(kind)
  return (
    <div
      className={styles.device}
      data-kind={kind}
      style={{
        width: screen.width + insets.x * 2,
        height: screen.height + insets.top + insets.bottom,
        padding: `${insets.top}px ${insets.x}px ${insets.bottom}px`,
        ...style,
      }}
    >
      <div className={styles.screen} style={{ width: screen.width, height: screen.height }}>
        {children}
      </div>
    </div>
  )
}
