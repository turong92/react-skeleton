import { useAuth } from '@skeleton/auth'
import { unregisterPush } from '@skeleton/push'
import { useNavigate } from 'react-router-dom'
import { pushApi } from '../push/api'

/** 로그아웃 — 푸시 기기 등록을 **토큰을 지우기 전에** 해지한다(지운 뒤에는 인증이 없어 서버의 기기 줄을 못 지운다). 해지가 실패해도 로그아웃은 막히지 않는다 */
export function useSignOut() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return async function signOut() {
    await unregisterPush(pushApi)
    logout()
    navigate('/login', { replace: true })
  }
}
