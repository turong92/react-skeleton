/** 내 작성자 프로필 한 개 — `GET /author-profiles` 의 한 항목. `id` 는 공개 작성자 id(`prf_…`, 계정 id 가 아니다) */
export type AuthorProfile = {
  id: string
  name: string
  /** 같은 이름의 서로 다른 사람을 구분하는 꼬리표 — 화면에는 `이름#꼬리표` */
  tag: string
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

/** 화면에 그리는 `이름#꼬리표` */
export const profileDisplay = (profile: Pick<AuthorProfile, 'name' | 'tag'>): string =>
  `${profile.name}#${profile.tag}`
