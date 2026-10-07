import type { AuthorProfile } from './types'

/**
 * 선택기의 처음 값 — 세 단계: ① 이 스레드에서 쓴 프로필 → ② 이 기기가 이 게시판에서 기억하는 프로필 → ③ 비어 있음(골라야 보낼 수 있다).
 * 지금 살아 있는 내 프로필이 아닌 id(지운 프로필)는 건너뛴다. 프로필이 하나뿐이어도 추측해서 채우지 않는다.
 * **`threadLoading`(댓글을 아직 받는 중)이면 확정하지 않는다** — 그때의 `threadAuthorId` undefined 는 「쓴 적 없음」이 아니라 「아직 모름」이라, 기기 기억으로 넘어가면 나중에 알게 된 스레드 프로필과 어긋난다.
 */
export function resolveInitialAuthor(input: {
  profiles: readonly Pick<AuthorProfile, 'id'>[]
  threadAuthorId: string | undefined
  remembered: string | undefined
  threadLoading?: boolean
}): string | undefined {
  return resolveInitial(input)?.id
}

/** 스스로 채운 값 — 어디서 왔는가: 이 스레드(①) 또는 이 기기의 기억(②) */
export type AutoValue = { id: string; source: 'thread' | 'memory' }

/** `resolveInitialAuthor` 와 같은 세 단계인데 값이 **어디서** 왔는지도 돌려준다(스레드 ① → `thread`, 기기 기억 ② → `memory`). 비어 있으면 undefined */
export function resolveInitial({
  profiles,
  threadAuthorId,
  remembered,
  threadLoading = false,
}: {
  profiles: readonly Pick<AuthorProfile, 'id'>[]
  threadAuthorId: string | undefined
  remembered: string | undefined
  threadLoading?: boolean
}): AutoValue | undefined {
  if (threadLoading) return undefined
  const alive = (id: string | undefined) =>
    id !== undefined && profiles.some((profile) => profile.id === id) ? id : undefined
  const fromThread = alive(threadAuthorId)
  if (fromThread !== undefined) return { id: fromThread, source: 'thread' }
  const fromMemory = alive(remembered)
  return fromMemory !== undefined ? { id: fromMemory, source: 'memory' } : undefined
}

/**
 * 선택기가 **스스로 채운** 값 중 **기기 기억(②)에서 온 것**만 스레드가 나중에 다른 내 프로필을 가리키면 그쪽으로 다시 정한다(스레드 ① 이 기기 기억 ② 를 이긴다).
 * 첫 불러오기가 실패했다 재시도로 도착하거나 쪽 · 정렬을 넘겨 내 댓글이 있는 쪽이 보일 때가 그 경우다.
 * 스레드(①)가 정한 값은 고정이다 — 쪽 · 정렬을 넘겨 다른 프로필의 댓글이 보여도 바뀌지 않는다. 사람이 고른 값(`auto` 없음 · 다른 값)도 건드리지 않는다(바꾸는 쪽은 한 줄 확인).
 */
export function threadOverridesAuto({
  profiles,
  value,
  auto,
  threadAuthorId,
  threadLoading,
}: {
  profiles: readonly Pick<AuthorProfile, 'id'>[]
  value: string | undefined
  auto: AutoValue | undefined
  threadAuthorId: string | undefined
  threadLoading: boolean
}): string | undefined {
  if (threadLoading || value === undefined || auto?.id !== value || auto.source !== 'memory')
    return undefined
  if (threadAuthorId === undefined || threadAuthorId === value) return undefined
  return profiles.some((profile) => profile.id === threadAuthorId) ? threadAuthorId : undefined
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
