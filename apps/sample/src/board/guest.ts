import { useAuth } from '@skeleton/auth'
import type { Board, BoardConfig, GuestUi } from '@skeleton/board'
import { useMemo } from 'react'

const TOKEN_KEY = 'board:guest-token'

/** `TOKEN` 방식의 비밀 — 이 브라우저가 만든 무작위 값(43자 base64url = 256비트)을 들고 있다가 고치기 · 지우기에도 같은 값을 보낸다 */
function guestToken(): string {
  try {
    const kept = globalThis.localStorage?.getItem(TOKEN_KEY)
    if (kept) return kept
  } catch {
    // 저장소를 쓸 수 없다 — 이 탭 동안만
  }
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const token = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  try {
    globalThis.localStorage?.setItem(TOKEN_KEY, token)
  } catch {
    // 위와 같다
  }
  return token
}

/**
 * 로그인하지 않은 사람이 이 게시판에 쓸 수 있을 때만 비회원 칸 설정 — 서버 설정(`guestEnabled`)과 게시판의 `settings.guestWrite`가 정한다
 * (`comments`: COMMENTS 이상, `posts`: ALL). 로그인했으면 undefined(회원으로 쓴다).
 */
export function useGuestUi(
  config: BoardConfig | undefined,
  board: Board | undefined,
  kind: 'comments' | 'posts',
): GuestUi | undefined {
  const { principal } = useAuth()
  const allowed = board?.settings?.guestWrite
  const ok = kind === 'posts' ? allowed === 'ALL' : allowed === 'COMMENTS' || allowed === 'ALL'
  const secretKind = config?.guestSecret ?? 'PASSWORD'
  const token = useMemo(() => (secretKind === 'TOKEN' ? guestToken() : undefined), [secretKind])
  if (principal || !config?.guestEnabled || !ok) return undefined
  return {
    secretKind,
    nameMaxLength: config.guestNameMaxLength ?? 20,
    token,
    captchaRequired: config.captchaRequired,
  }
}
