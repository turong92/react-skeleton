/** 서버 규칙(`^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$`) — 3~40자, 소문자 · 숫자 · 하이픈, 앞뒤 하이픈 없음 */
const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/
export const SLUG_MIN = 3
export const SLUG_MAX = 40

export type SlugProblem = 'length' | 'format'

/** 맞으면 null — 길이를 먼저 말한다(짧게 치는 도중에는 모양을 탓하지 않는다) */
export function slugProblem(slug: string): SlugProblem | null {
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) return 'length'
  return SLUG.test(slug) ? null : 'format'
}

/**
 * 이름에서 주소 제안을 만든다 — 악센트를 떼고 소문자 · 숫자가 아닌 덩어리를 하이픈 하나로.
 * 쓸 만한 것이 3자 미만이면 빈 문자열(주소를 안 보내면 서버가 정한다)
 */
export function slugFromName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '')
  return slug.length >= SLUG_MIN ? slug : ''
}
