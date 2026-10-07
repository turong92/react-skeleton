import { createContext, useContext } from 'react'

export type NicknameGate = {
  /** 닉네임을 정하는 대화상자를 연다(안내 띠의 단추가 부른다) */
  open: () => void
}

export const NicknameGateContext = createContext<NicknameGate>({ open: () => undefined })

export const useNicknameGate = () => useContext(NicknameGateContext)
