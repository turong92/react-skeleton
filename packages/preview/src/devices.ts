import { frameInsets, paintedBox, type FrameKind } from './frame'

export type PreviewDevice = 'phone' | 'tabletPortrait' | 'tabletLandscape' | 'pc'

/** 고르는 단추 순서 */
export const PREVIEW_DEVICES: readonly PreviewDevice[] = [
  'phone',
  'tabletPortrait',
  'tabletLandscape',
  'pc',
]

export const PC_WIDTHS = [1280, 1440, 1920] as const
export type PcWidth = (typeof PC_WIDTHS)[number]
export const DEFAULT_PC_WIDTH: PcWidth = 1280

export type DeviceViewport = { width: number; height: number; frame: FrameKind }

const PC_HEIGHT: Record<PcWidth, number> = { 1280: 800, 1440: 900, 1920: 1080 }

/** 기기의 CSS 뷰포트 크기와 틀 종류 */
export function deviceViewport(
  device: PreviewDevice,
  pcWidth: PcWidth = DEFAULT_PC_WIDTH,
): DeviceViewport {
  switch (device) {
    case 'phone':
      return { width: 390, height: 844, frame: 'phone' }
    case 'tabletPortrait':
      return { width: 820, height: 1180, frame: 'tablet' }
    case 'tabletLandscape':
      return { width: 1180, height: 820, frame: 'tablet' }
    case 'pc':
      return { width: pcWidth, height: PC_HEIGHT[pcWidth], frame: 'desktop' }
  }
}

/** 틀까지 넣은 바깥 크기 — 폭은 PC 받침까지 칠해지는 폭(paintedBox). 칸 폭을 잡을 때 쓴다 */
export function outerSize(
  device: PreviewDevice,
  pcWidth: PcWidth = DEFAULT_PC_WIDTH,
  kind?: FrameKind,
): { width: number; height: number } {
  const viewport = deviceViewport(device, pcWidth)
  const insets = frameInsets(kind ?? viewport.frame)
  return {
    width: paintedBox(kind ?? viewport.frame, viewport.width + insets.x * 2).width,
    height: viewport.height + insets.top + insets.bottom,
  }
}
