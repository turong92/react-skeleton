/**
 * 알림이 가리킬 수 있는 곳은 앱 안 경로뿐이다 — `/` 로 시작하고 `//` 로 시작하지 않고(`/` 바로 뒤의 역슬래시도 브라우저가 `//` 로 읽으므로 같이 막고) 제어 문자가 없다.
 * 서버도 같은 규칙으로 막지만 클라이언트가 링크를 따라가기 전에 한 번 더 확인한다.
 */
export function isAppLink(link: unknown): link is string {
  return (
    typeof link === 'string' &&
    link.startsWith('/') &&
    !link.startsWith('//') &&
    !link.startsWith('/\\') &&
    // eslint-disable-next-line no-control-regex
    !/[\u0000-\u001f\u007f]/.test(link)
  )
}
