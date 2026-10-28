import { useAuth } from '@skeleton/auth'
import { rewardsRoot, useReferralCapture, type ReferralStorage } from '@skeleton/rewards'
import { useQueryClient } from '@tanstack/react-query'
import { rewardsApi } from './api'

/** 저장소를 못 쓰는 브라우저(사생활 보호 모드 …)에서도 던지지 않는 `localStorage` */
const storage: ReferralStorage = {
  getItem: (key) => {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key, value) => {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // 저장하지 못하면 초대 코드를 기억하지 못할 뿐이다
    }
  },
  removeItem: (key) => {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // 위와 같다
    }
  },
}

/**
 * 초대 링크(`/?ref=코드`)의 코드를 30일 보관했다가, 로그인한 뒤 한 번 claim 한다(`useReferralCapture`). 화면은 없다 - 앱 루트(`main.tsx`)에서 `AuthProvider` 아래에 한 번 둔다.
 * 코드가 맞지 않아도(자기 코드 · 이미 초대받음 · 새 계정이 아님 …) 조용히 지운다 - 가입 흐름을 막지 않는다.
 */
export function ReferralCapture() {
  const { status } = useAuth()
  const client = useQueryClient()
  useReferralCapture({
    storage,
    signedIn: status === 'authenticated',
    claim: (code) => rewardsApi.claimReferral(code),
    onClaimed: () => void client.invalidateQueries({ queryKey: rewardsRoot }),
  })
  return null
}
