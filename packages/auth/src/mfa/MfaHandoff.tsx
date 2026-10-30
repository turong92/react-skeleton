import { useEffect, useRef } from 'react'
import type { MfaRequired } from './types'

/**
 * 2단계 인증이 남았다는 응답(`mfaRequiredOf`)을 받은 도착 화면(링크 · 소셜 콜백)이 렌더 중에 이동하지 않고 효과로 한 번 넘기는 자리.
 * 화면은 넘기는 사이 아무것도 그리지 않는다
 */
export function MfaHandoff({
  mfa,
  onMfaRequired,
}: {
  mfa: MfaRequired
  onMfaRequired: (mfa: MfaRequired) => void
}) {
  const handed = useRef(false)
  useEffect(() => {
    if (handed.current) return
    handed.current = true
    onMfaRequired(mfa)
  }, [mfa, onMfaRequired])
  return null
}
