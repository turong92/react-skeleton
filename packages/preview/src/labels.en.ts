import type { PreviewLabels } from './labels'

export const defaultPreviewLabels: PreviewLabels = {
  frameTitle: 'Preview',
  pcScroll: 'PC screen — scroll sideways',
  device: 'Device',
  devices: {
    phone: 'Phone',
    tabletPortrait: 'Tablet portrait',
    tabletLandscape: 'Tablet landscape',
    pc: 'PC',
  },
  size: 'Size',
  fit: (percent) => `Fit (${percent}%)`,
  actual: (percent) => `${percent}% (actual size)`,
  percent: (percent) => `${percent}%`,
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fitButton: 'Fit',
  stage: 'Preview screen — drag or use arrow keys to move',
  controls: 'Preview controls',
  touch: 'Touch the preview',
  touchNote: 'Tap and scroll inside the preview as on the real screen',
  hintPan:
    'Drag to move. Zoom with Ctrl/⌘ + wheel or two fingers. Arrow keys move, and +, − and 0 (fit) change the zoom',
  hintPanTouch: 'Drag to move, and zoom with two fingers',
  hintTouch:
    "You're touching the preview — the wheel and your finger scroll inside it. Turn this off to drag again",
  shrunk: (percent) => `Shown at ${percent}% — view actual size`,
  replay: 'Replay',
  openWindow: 'Open in new window',
  close: 'Close',
  expand: 'Expand preview settings',
  collapse: 'Collapse',
  panelTitle: 'Preview',
}
