/**
 * 메일 링크의 일회용 토큰. 백엔드가 보내는 모양은 `?token=…`(쿼리) 이지만, 프론트가 링크를 `#token=…`(조각)로 바꿔 줄 수도 있다 —
 * 조각은 서버 로그 · Referer 에 남지 않는다. 둘 다 읽고 조각을 우선한다. 읽은 뒤에는 `history.replaceState` 로 주소창에서 지우는 것이 좋다.
 */
export function readLinkToken(location: { hash: string; search: string }): string | null {
  const fromHash = new URLSearchParams(location.hash.replace(/^#/, '')).get('token')
  if (fromHash) return fromHash
  return new URLSearchParams(location.search).get('token') || null
}
