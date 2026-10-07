import { createContext, useContext } from 'react'

export type NicknameGate = {
  /** 닉네임을 정하는 대화상자를 연다 */
  open: () => void
  /**
   * 쓰기 직전에 부른다 — 쓸 수 있으면 true. 닉네임이 없으면 대화상자를 열고 false(쓰던 글은 호출한 쪽이 그대로 둔다).
   * 프로필을 아직 모르거나 앱이 끈 경우(`NICKNAME_BEFORE_WRITE`)는 막지 않는다. 로그인한 구역 밖에서는 늘 true
   */
  ensure: () => boolean
}

export const NicknameGateContext = createContext<NicknameGate>({
  open: () => undefined,
  ensure: () => true,
})

export const useNicknameGate = () => useContext(NicknameGateContext)
