export type LoadMoreState = {
  hasMore: boolean
  loading: boolean
  /** 직전 쪽이 실패했다 — 사람이 「다시 시도」를 눌러야 한다(자동으로 돌면 실패가 무한 반복된다) */
  error: boolean
  /** 목록 끝 표지가 화면에 보인다 */
  intersecting: boolean
}

/** 끝 표지가 보일 때 다음 쪽을 부를까 */
export const shouldLoadMore = ({ hasMore, loading, error, intersecting }: LoadMoreState) =>
  hasMore && !loading && !error && intersecting
