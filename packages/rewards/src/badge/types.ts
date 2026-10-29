/** 내 배지 중 받은 것 한 개 — `GET {badges}/me` 의 `earned` */
export type EarnedBadge = {
  /** 보유 줄 id — 프로필에 보이기 스위치(`PATCH me/{awardId}`)의 대상 */
  awardId: string
  code: string
  name: string
  description: string
  imageUrl: string | null
  /** 숨은 업적 — 받고 나면 이름이 보인다 */
  hidden: boolean
  /** 운영이 보관한 정의 — 받은 것으로만 남는다 */
  archived: boolean
  /** 프로필에 보일지 */
  visible: boolean
  awardedAt: string
}

/**
 * 아직 받지 못한(또는 회수된) 배지 한 개 — `locked`.
 * 숨은 정의(`hidden`)는 서버가 코드 · 이름 · 설명 · 그림을 null 로 비워 보낸다.
 */
export type LockedBadge = {
  hidden: boolean
  code: string | null
  name: string | null
  description: string | null
  imageUrl: string | null
}

export type MyBadges = { earned: EarnedBadge[]; locked: LockedBadge[] }

/**
 * 로그인 없이 읽는 프로필 배지 — **이 넷뿐이다**(받은 시각 · id · 출처가 없다).
 * 서버가 필드를 더하지 않는 것이 공개 계약이라 이 타입도 더하지 않는다.
 */
export type PublicBadge = {
  code: string
  name: string
  description: string
  imageUrl: string | null
}
