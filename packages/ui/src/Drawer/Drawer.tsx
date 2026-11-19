import { Dialog, type DialogProps } from '../Dialog/Dialog'

export type DrawerProps = Omit<DialogProps, 'placement' | 'fullScreen'> & {
  /** 붙는 가장자리(기본 `right`). `bottom` 은 폰의 아래 시트 */
  side?: 'left' | 'right' | 'bottom'
}

/**
 * 가장자리에서 밀려 나오는 판 — 필터 · 상세 · 모바일 메뉴. 열고 닫기 · 포커스 가두기 · Esc · 바깥 누름 · 스크롤 잠금은 `Dialog` 와 같은 구현이다
 * (그래서 prop 도 같다: `open` · `onClose` · `title` · `footer` · `closeLabel` · `dismissible`). 모양은 `--overlay-*` 부품 토큰, 모션 감소 설정이면 바로 열고 닫힌다
 */
export function Drawer({ side = 'right', ...dialog }: DrawerProps) {
  return <Dialog {...dialog} placement={side} />
}
