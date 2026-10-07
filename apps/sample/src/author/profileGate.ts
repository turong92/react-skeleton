import type { AuthorProfile } from '@skeleton/author-profile'

/**
 * 쓰기 전에 「프로필부터 만들어요」를 띄워야 하는가 — 서버가 작성자를 요구하는데(`authorRequired`) 내 프로필이 하나도 없을 때뿐이다.
 * 목록을 아직 모르거나(불러오는 중 · 실패) 서버가 프로필을 안 쓰면 막지 않는다 — 그때의 방어는 선택기와 서버(400 `BOARD.AUTHOR_REQUIRED`)의 몫이다.
 */
export function mustCreateProfileFirst({
  authorRequired,
  profiles,
}: {
  authorRequired: boolean | undefined
  profiles: readonly AuthorProfile[] | undefined
}): boolean {
  return authorRequired === true && profiles !== undefined && profiles.length === 0
}
