/** 기기 틀이 화면 둘레에 더하는 두께(px) — 배율은 틀까지 넣어 칸에 맞춘다 */
export type FrameInsets = { x: number; top: number; bottom: number }

/** `plain` — 틀 없이 화면만(폰 안에 폰 틀이 또 들어가지 않게) */
export type FrameKind = 'phone' | 'tablet' | 'desktop' | 'plain'

const INSETS: Record<FrameKind, FrameInsets> = {
  phone: { x: 8, top: 8, bottom: 8 },
  tablet: { x: 14, top: 14, bottom: 14 },
  // 모니터 — 베젤 6 + 아래 받침 12
  desktop: { x: 6, top: 6, bottom: 18 },
  plain: { x: 0, top: 0, bottom: 0 },
}

export function frameInsets(kind: FrameKind): FrameInsets {
  return INSETS[kind]
}

/** PC 받침이 바깥 상자 양옆으로 나오는 비율 — `DeviceFrame.module.css` 의 받침 `left`/`right: -3%` 와 짝 */
export const DESKTOP_BASE_OVERHANG = 0.03

/**
 * 틀이 실제로 칠해지는 가로 범위(바깥 상자 기준, 줄이기 전 px) — `left` 는 바깥 상자 왼쪽 앞에 비워 둘 자리,
 * `width` 는 양옆 받침까지 넣은 폭. 칸에 맞춰 줄이거나 자리 상자를 잡을 때 `frameInsets` 폭 대신 이 `width` 를 쓴다
 */
export function paintedBox(kind: FrameKind, outerWidth: number): { left: number; width: number } {
  if (kind !== 'desktop') return { left: 0, width: outerWidth }
  const left = outerWidth * DESKTOP_BASE_OVERHANG
  return { left, width: outerWidth + left * 2 }
}
