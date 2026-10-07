/**
 * 내 작성자 프로필 한 개 — `GET /author-profiles` 의 한 항목. `id` 는 공개 작성자 id(`prf_…`, 계정 id 가 아니다).
 * `name` · `tag` 는 null 일 수 있다 — 이름 없는 옛 글을 넘겨받은 첫 프로필은 `name` 이 null, 꼬리표 방식이 꺼진 서버는 `tag` 가 null.
 */
export type AuthorProfile = {
  id: string
  name: string | null
  /** 같은 이름의 서로 다른 사람을 구분하는 꼬리표 — 있으면 화면에는 `이름#꼬리표`, 없으면 이름만 */
  tag: string | null
  createdAt: string
}

/** `GET /author-profiles/config` */
export type AuthorProfileConfig = {
  /** 계정당 살아 있는 프로필 수 상한 */
  maxPerAccount: number
  /** 이름 길이 상한(코드 포인트) */
  nameMaxLength: number
}

/** `POST` · `PATCH` 본문 */
export type AuthorProfileInput = { name: string }

/**
 * 화면에 그리는 `이름#꼬리표` — 꼬리표가 없으면 `#` 도 없고, 이름이 없으면 `unnamed`(앱이 번역해 준 「이름 없음」, 기본 `Unnamed`)로 대신한다.
 */
export const profileDisplay = (
  profile: Pick<AuthorProfile, 'name' | 'tag'>,
  unnamed = 'Unnamed',
): string => `${profile.name ?? unnamed}${profile.tag ? `#${profile.tag}` : ''}`
