import { RequireAuth, type RequireAuthProps } from '@skeleton/auth'
import { Spinner } from '@skeleton/ui'
import { useSessionRestored } from './useSessionRestored'

export type ClientRequireAuthProps = RequireAuthProps & {
  /** 복원이 끝나기 전 자리 표시의 낭독 이름(기본 `확인 중`) */
  placeholderLabel?: string
}

/**
 * `RequireAuth` 의 서버 렌더 · 하이드레이션 안전판. 토큰은 브라우저에만 있어 서버는 로그인 여부를 모른다 —
 * 그래서 복원이 끝나기 전에는 보호된 내용도 `/login` 이동도 그리지 않고 중립 자리 표시(스피너)만 그린다.
 * 끝나면 `RequireAuth` 와 똑같이 동작한다(로그인 안 했으면 `/login` 으로, 돌아올 위치를 기억한다).
 * 쿠키 기반으로 바꾸면(HttpOnly 세션 쿠키) 서버가 알 수 있어 이 껍데기가 필요 없다 — README 「인증」 참고.
 */
export function ClientRequireAuth({
  placeholderLabel = '확인 중',
  ...props
}: ClientRequireAuthProps) {
  const restored = useSessionRestored()
  if (!restored) return <Spinner label={placeholderLabel} />
  return <RequireAuth {...props} />
}
