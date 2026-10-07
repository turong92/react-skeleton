/** 배너가 건드리는 두 요소의 스타일 — 실제로는 `document.body` · `document.documentElement` */
export type SpaceTarget = {
  body: { style: { paddingBottom: string } }
  root: { style: { scrollPaddingBottom: string } }
}

/**
 * 화면 아래에 떠 있는 것의 높이만큼 페이지 아래를 비워 둔다 — ① `body` 아래 안쪽 여백(맨 끝까지 스크롤하면 모든 것이 배너 위에 온다)
 * ② `html` 의 `scroll-padding-bottom`(`focus` · `scrollIntoView` 가 배너 밑으로 숨지 않는다). 원래 값은 `release()` 가 되돌린다.
 */
export function reserveBottomSpace(target: SpaceTarget, px: number) {
  const bodyBefore = target.body.style.paddingBottom
  const rootBefore = target.root.style.scrollPaddingBottom
  const set = (height: number) => {
    target.body.style.paddingBottom = bodyBefore
      ? `calc(${bodyBefore} + ${height}px)`
      : `${height}px`
    target.root.style.scrollPaddingBottom = `${height}px`
  }
  set(px)
  return {
    set,
    release() {
      target.body.style.paddingBottom = bodyBefore
      target.root.style.scrollPaddingBottom = rootBefore
    },
  }
}
