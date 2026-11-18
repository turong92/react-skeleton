import type { PreviewDevice } from './devices'

/** 화면 문구 — 평평한 객체. 일부만 덮을 때는 `{ ...defaultPreviewLabels, replay: '…' }` */
export type PreviewLabels = {
  /** iframe 이름 */
  frameTitle: string
  /** PC 실제 크기 — 가로로 미는 영역 이름 */
  pcScroll: string
  /** 기기 고르기 묶음 이름 */
  device: string
  devices: Record<PreviewDevice, string>
  /** 배율 묶음 이름 */
  size: string
  fit: (percent: number) => string
  actual: (percent: number) => string
  percent: (percent: number) => string
  zoomIn: string
  zoomOut: string
  fitButton: string
  stage: string
  controls: string
  touch: string
  touchNote: string
  hintPan: string
  hintPanTouch: string
  hintTouch: string
  shrunk: (percent: number) => string
  replay: string
  openWindow: string
  close: string
  expand: string
  collapse: string
  panelTitle: string
}
