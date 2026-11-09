import { useAuth } from '@skeleton/auth'
import { unregisterPush } from '@skeleton/push'
import { useNavigate } from 'react-router-dom'
import { pushApi } from '../push/api'

/** 푸시 기기 등록 해지 — 라우터 바깥의 막(`EmailGate` · `LegalGate`)도 로그아웃 전에 같은 걸 부른다. 실패해도 던지지 않는다 */
export const releasePush = () => unregisterPush(pushApi)

/** 로그아웃 — 푸시 기기 등록을 **토큰을 지우기 전에** 해지한다(지운 뒤에는 인증이 없어 서버의 기기 줄을 못 지운다). 해지가 실패해도 로그아웃은 막히지 않는다 */
export function useSignOut() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return async function signOut() {
    await releasePush()
    logout()
    navigate('/login', { replace: true })
  }
}
