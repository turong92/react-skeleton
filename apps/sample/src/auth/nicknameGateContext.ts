import { createContext, useContext } from 'react'

export type NicknameGate = {
  /** 닉네임을 정하는 대화상자를 연다(안내 띠의 단추가 부른다) — 닫을 때 포커스는 연 단추로 돌아간다 */
  open: (event?: { currentTarget: Element }) => void
}

export const NicknameGateContext = createContext<NicknameGate>({ open: () => undefined })

export const useNicknameGate = () => useContext(NicknameGateContext)
