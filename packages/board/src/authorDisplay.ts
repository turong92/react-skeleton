/*
 * 작성자를 화면에 어떻게 보이는지 정하는 한 곳 — 글 목록 · 글 상세 · 댓글이 모두 이 규칙을 쓴다.
 * 계정 id(`acc_…`)는 어디에도 그리지 않는다: 닉네임이 있으면 그것, 탈퇴했으면 「탈퇴한 사용자」, 없으면 「이름 없는 사용자」.
 */

/** 작성자 자리에 쓰는 글자 — 기본은 영어 */
export type AuthorLabels = {
  /** 탈퇴한 작성자(`authorDeleted` 또는 id 가 `deleted:` 로 시작) */
  authorDeleted: string
  /** 닉네임이 없는 작성자 */
  authorUnnamed: string
}

export const defaultAuthorLabels: AuthorLabels = {
  authorDeleted: 'Deleted user',
  authorUnnamed: 'Unnamed user',
}

/** 글 · 댓글 응답에서 작성자를 정하는 데 쓰는 필드 — 옛 서버는 `authorName` 이 없다 */
export type AuthorFields = {
  authorId: string
  authorName?: string | null
  authorDeleted?: boolean
  /** 서버가 붙이는 4자리 꼬리표(`수민#4821` 의 `4821`) — 꼬리표 방식이 꺼진 서버 · 옛 서버는 null · 없음 */
  authorTag?: string | null
}

/**
 * 꼬리표를 보일 때 — `collision`(기본): 같은 화면에서 서로 다른 계정이 같은 닉네임을 쓸 때만,
 * `always`: 항상(프로필 · 설정), `never`: 보이지 않는다
 */
export type AuthorTagMode = 'always' | 'collision' | 'never'

export type AuthorKind = 'named' | 'unnamed' | 'deleted'

/** 화면에 보일 작성자 — `name` 은 항상 사람이 읽는 글자(계정 id 가 아니다) */
export type ResolvedAuthor = { kind: AuthorKind; name: string; tag: string | null }

/** `renderAuthor` 가 계정 id 와 함께 받는 정보 */
export type AuthorInfo = ResolvedAuthor & { deleted: boolean }

const DELETED_ID_PREFIX = 'deleted:'

export function resolveAuthor(
  fields: AuthorFields,
  labels: AuthorLabels = defaultAuthorLabels,
): ResolvedAuthor {
  if (fields.authorDeleted === true || fields.authorId.startsWith(DELETED_ID_PREFIX))
    return { kind: 'deleted', name: labels.authorDeleted, tag: null }
  const name = fields.authorName?.trim()
  if (name) return { kind: 'named', name, tag: fields.authorTag || null }
  return { kind: 'unnamed', name: labels.authorUnnamed, tag: null }
}

/** 한 화면(목록 · 스레드)에서 서로 다른 계정이 같이 쓰는 닉네임들 — 꼬리표가 필요한 이름 */
export function collidingNames(items: Iterable<AuthorFields>): ReadonlySet<string> {
  const owners = new Map<string, Set<string>>()
  for (const item of items) {
    const resolved = resolveAuthor(item)
    if (resolved.kind !== 'named') continue
    const set = owners.get(resolved.name) ?? new Set<string>()
    set.add(item.authorId)
    owners.set(resolved.name, set)
  }
  return new Set([...owners].filter(([, ids]) => ids.size > 1).map(([name]) => name))
}

/** 꼬리표를 그릴지 */
export function showsTag(mode: AuthorTagMode, collides: boolean, tag: string | null): boolean {
  return tag !== null && (mode === 'always' || (mode === 'collision' && collides))
}
