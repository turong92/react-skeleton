/**
 * 펴진 미리보기(iframe 이 문서 높이만큼 늘어 있다)의 **지금 보이는 창** — 스크롤 상자의 화면 구간과 iframe 의 교집합을 iframe 안 px 로.
 * 모달이 열린 동안 무대는 iframe 을 이 `height` 로 줄여 `top` 자리에 놓는다.
 * `viewTop` · `viewBottom` = 스크롤 상자의 화면 구간, `frameTop` = iframe 안 문서 맨 위의 화면 위치(배율 적용),
 * `docH` = 문서 높이(iframe px), `scale` = 배율. 보이는 높이가 [MIN_VISIBLE] 보다 작으면 null(모달을 놓을 자리가 없다 — 줄이지 않는다)
 */
export const MIN_VISIBLE = 120

export function visibleWindow(o: {
  viewTop: number
  viewBottom: number
  frameTop: number
  docH: number
  scale: number
}): { top: number; height: number } | null {
  const winTop = Math.max(o.viewTop, o.frameTop)
  const winBottom = Math.min(o.viewBottom, o.frameTop + o.docH * o.scale)
  const height = Math.round((winBottom - winTop) / o.scale)
  if (!(height >= MIN_VISIBLE)) return null
  return { top: Math.round((winTop - o.frameTop) / o.scale), height }
}

/**
 * 펴진 미리보기에서 안쪽 top 을 바깥 스크롤 상자 위(headH 아래, room 여유)에 두는 scrollTop.
 * `top` = 미리보기 문서 맨 위에서 대상 위 끝(iframe 안 px, 줄이기 전 값), `frameTop` = iframe 의 화면 위 끝(이미 줄어든 값)
 */
export function outerScrollTop(o: {
  scrollY: number
  frameTop: number
  top: number
  scale: number
  headH: number
  room: number
}): number {
  return Math.max(0, Math.round(o.scrollY + o.frameTop + o.top * o.scale - o.headH - o.room))
}
