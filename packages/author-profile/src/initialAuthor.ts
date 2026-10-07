import type { AuthorProfile } from './types'

/**
 * 선택기의 처음 값 — 세 단계: ① 이 스레드에서 쓴 프로필 → ② 이 기기가 이 게시판에서 기억하는 프로필 → ③ 비어 있음(골라야 보낼 수 있다).
 * 지금 살아 있는 내 프로필이 아닌 id(지운 프로필)는 건너뛴다. 프로필이 하나뿐이어도 추측해서 채우지 않는다.
 */
export function resolveInitialAuthor({
  profiles,
  threadAuthorId,
  remembered,
}: {
  profiles: readonly Pick<AuthorProfile, 'id'>[]
  threadAuthorId: string | undefined
  remembered: string | undefined
}): string | undefined {
  const alive = (id: string | undefined) =>
    id !== undefined && profiles.some((profile) => profile.id === id) ? id : undefined
  return alive(threadAuthorId) ?? alive(remembered)
}

/**
 * 한 줄 확인이 필요한가 — 이 스레드에서 쓴 프로필을 두고 **다른 것으로** 바꿀 때만, 그 스레드 프로필을 돌려준다.
 * 같은 프로필로 바꾸거나, 이 스레드에 쓴 적이 없거나, 쓴 프로필이 지워졌으면 undefined.
 */
export function switchNotice<P extends Pick<AuthorProfile, 'id'>>({
  profiles,
  threadAuthorId,
  nextId,
}: {
  profiles: readonly P[]
  threadAuthorId: string | undefined
  nextId: string
}): P | undefined {
  if (threadAuthorId === undefined || threadAuthorId === nextId) return undefined
  return profiles.find((profile) => profile.id === threadAuthorId)
}
