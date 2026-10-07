/** 화면에 보일 내 이름과 닉네임 안내가 필요한지 — `GET /account/me` 의 필드만 본다(이메일 · 계정 id 로 이름을 만들지 않는다) */
type ProfileNames = { displayName: string | null; displayTag?: string | null }

/** `닉네임` 또는 `닉네임#번호`. 닉네임이 없으면 null */
export function shownName(me: ProfileNames | null | undefined): string | null {
  const name = me?.displayName?.trim()
  if (!name) return null
  return me?.displayTag ? `${name}#${me.displayTag}` : name
}

/** 프로필을 읽었고 닉네임이 없다 — 계정 설정으로 가는 안내(막지 않는다)를 보일 때 */
export function needsNickname(me: ProfileNames | null | undefined): boolean {
  return me != null && !me.displayName?.trim()
}

/** 인사말에 쓸 이름 — 닉네임(꼬리표 없이)뿐. null 이면 화면이 중립 인사를 쓴다 */
export function greetingOf(me: ProfileNames | null | undefined): { name: string | null } {
  return { name: me?.displayName?.trim() || null }
}
