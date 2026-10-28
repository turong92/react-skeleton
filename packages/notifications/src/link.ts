/**
 * 알림이 가리킬 수 있는 곳은 앱 안 경로뿐이다 — `/` 로 시작하고 `//` 로 시작하지 않으며 백슬래시 · 제어 문자가 없고 정규화해도 `//` 로 시작하지 않는다.
 * 서버도 같은 규칙으로 막지만 클라이언트가 링크를 따라가기 전에 한 번 더 확인한다.
 */
export function isAppLink(link: unknown): link is string {
  if (typeof link !== 'string' || !link.startsWith('/') || link.startsWith('//')) return false
  // 백슬래시 · 제어 문자는 어디에 있든 거절한다(브라우저가 지우거나 `/` 로 읽어 `//` 가 될 수 있다)
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f-\u009f]/.test(link)) return false
  // `/a/..//x` 처럼 정규화하면 `//` 로 시작하는 경로도 거절한다
  try {
    return !new URL(link, 'http://x').pathname.startsWith('//')
  } catch {
    return false
  }
}
