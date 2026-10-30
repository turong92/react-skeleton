/** 팀 화면의 주소 — 팀은 주소의 slug 에서만 읽는다(탭마다 다르다). `/w/<slug>/…` */
export const teamPath = (slug: string, rest = 'notes') => `/w/${slug}/${rest}`

export const slugFromPath = (pathname: string): string | undefined =>
  /^\/w\/([^/]+)/.exec(pathname)?.[1]

/** 옛 slug 로 들어왔을 때 — slug 한 칸만 바꾸고 나머지 주소 · 검색 · 해시는 그대로(`navigate(…, { replace: true })`) */
export function swapSlug(
  location: { pathname: string; search: string; hash: string },
  slug: string,
): string {
  return `${location.pathname.replace(/^\/w\/[^/]+/, `/w/${slug}`)}${location.search}${location.hash}`
}
