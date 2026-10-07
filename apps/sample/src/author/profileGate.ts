import type { AuthorProfile } from '@skeleton/author-profile'

/**
 * 쓰기 전에 「이름 있는 프로필부터 만들어요」를 띄워야 하는가 — 서버가 작성자를 요구하는데(`authorRequired`) 이름 있는 프로필이 하나도 없을 때뿐이다.
 * 백엔드는 `GET /author-profiles` 를 처음 부를 때 첫 프로필을 만든다: 그 시점에 닉네임이 있었으면 그 이름 · 꼬리표를 한 번 복사하고, 없었으면 이름 없는(`name` null) 첫 프로필이다(그 뒤 닉네임을 정해도 프로필 이름은 바뀌지 않는다).
 * 그래서 「프로필이 0개」만이 아니라 「전부 이름 없음」도 막는다 — 이름 없는 프로필로 처음 쓰기 전에 이름을 정하게 한다(이전의 「닉네임 없이는 쓰기 전에 묻기」 보호).
 * 보장하는 범위: 목록을 받은 뒤의 판단뿐이다 — 이 함수가 서버의 거절(400 `BOARD.AUTHOR_REQUIRED`)을 대신하지는 않는다.
 * 목록을 아직 모르거나(불러오는 중 · 실패) 서버가 프로필을 안 쓰면 막지 않는다 — 그때의 방어는 선택기와 서버(400 `BOARD.AUTHOR_REQUIRED`)의 몫이다.
 */
export function mustCreateProfileFirst({
  authorRequired,
  profiles,
}: {
  authorRequired: boolean | undefined
  profiles: readonly AuthorProfile[] | undefined
}): boolean {
  return (
    authorRequired === true &&
    profiles !== undefined &&
    profiles.every((profile) => !profile.name?.trim())
  )
}
