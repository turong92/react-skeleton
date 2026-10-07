/**
 * 열린 메뉴 상자를 놓는다 — 아래 자리가 모자라면 위로(`data-placement`), 원하는 쪽 끝 정렬(`data-align`)이 화면 밖으로 넘치면 반대쪽으로 맞춘다.
 * 뒤집어도 넘치면(좁은 화면에서 상자가 단추 한쪽 자리보다 넓다) **넘친 만큼 화면 안으로 당긴다**(`translate`) — `left ≥ 0 && right ≤ 화면 폭`.
 * 상자가 화면보다 넓으면 왼쪽을 우선한다. 조상의 변형(확대)이 있어도 맞도록 보이는 폭 / 레이아웃 폭 비율로 보정한다.
 */
export function placeMenu(menu: HTMLElement, button: HTMLElement, align: 'start' | 'end'): void {
  menu.style.translate = ''
  const anchor = button.getBoundingClientRect()
  const below = window.innerHeight - anchor.bottom
  const needed = menu.getBoundingClientRect().height
  menu.dataset.placement = needed > below && anchor.top > below ? 'top' : 'bottom'
  // 원하는 쪽(기본 끝)에 맞추고, 그쪽 화면 밖으로 넘치면 반대로 맞춘다(왼쪽 끝 버튼의 메뉴가 잘리지 않게)
  menu.dataset.align = align
  const outside = (box: DOMRect) => box.left < 0 || box.right > window.innerWidth
  if (outside(menu.getBoundingClientRect())) menu.dataset.align = align === 'end' ? 'start' : 'end'
  // 그래도 넘치면 당긴다
  const box = menu.getBoundingClientRect()
  const shift =
    box.left < 0
      ? -box.left
      : box.right > window.innerWidth
        ? Math.max(window.innerWidth - box.right, -box.left) // 왼쪽이 화면 밖으로 나가지 않는 만큼만
        : 0
  if (shift === 0) return
  const scale = menu.offsetWidth > 0 ? box.width / menu.offsetWidth : 1
  menu.style.translate = `${shift / scale}px 0`
}
