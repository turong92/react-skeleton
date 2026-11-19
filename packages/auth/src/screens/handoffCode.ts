/**
 * 앱이 연 웹 결제 주소의 한 번 쓰는 코드: `<결제 주소>#handoff=<코드>`. **조각(`#`)에서만 읽는다** — 조각은 서버 · 프록시 접근 로그와 Referer 에 가지 않는다
 * (쿼리의 `?handoff=` 는 읽지 않는다 - 그 모양으로 온 값은 쓰지 않고 `scrubUrlParams(['handoff'])` 가 주소에서 지우기만 한다). 읽은 뒤에는 바로 주소에서 지운다.
 */
export function readHandoffCode(location: { hash: string }): string | null {
  return new URLSearchParams(location.hash.replace(/^#/, '')).get('handoff') || null
}
