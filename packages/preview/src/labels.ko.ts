import type { PreviewLabels } from './labels'

export const koPreviewLabels: PreviewLabels = {
  frameTitle: '미리보기',
  pcScroll: 'PC 화면 — 가로로 밀어 보기',
  device: '기기',
  devices: {
    phone: '폰',
    tabletPortrait: '태블릿 세로',
    tabletLandscape: '태블릿 가로',
    pc: 'PC',
  },
  size: '크기',
  fit: (percent) => `맞추기 (${percent}%)`,
  actual: (percent) => `${percent}% (실제 크기)`,
  percent: (percent) => `${percent}%`,
  zoomIn: '확대',
  zoomOut: '축소',
  fitButton: '맞추기',
  stage: '미리보기 화면 — 끌거나 화살표 키로 옮기기',
  controls: '미리보기 조작',
  touch: '화면 직접 눌러 보기',
  touchNote: '실제 화면처럼 미리보기 안을 눌러 보고 스크롤해요',
  hintPan:
    '끌어서 옮기고, Ctrl/⌘ + 휠이나 두 손가락으로 키우거나 줄여요. 화살표 키로 옮기고 +, −, 0(맞추기)으로 배율을 바꿔요',
  hintPanTouch: '끌어서 옮기고, 두 손가락으로 키우거나 줄여요',
  hintTouch:
    '화면을 직접 누르는 중이에요. 휠과 손가락으로 안쪽이 스크롤돼요. 끄면 다시 끌어서 옮길 수 있어요',
  shrunk: (percent) => `${percent}%로 줄여 보는 중 — 실제 크기로 보기`,
  replay: '다시 재생',
  openWindow: '새 창에서 보기',
  close: '닫기',
  expand: '미리보기 설정 펴기',
  collapse: '접기',
  panelTitle: '미리보기',
}
