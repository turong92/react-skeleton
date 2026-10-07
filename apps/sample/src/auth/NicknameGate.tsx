import { useMemo, type ReactNode } from 'react'
import { useNicknameDialog } from '../author/useNicknameDialog'
import { NicknameGateContext, type NicknameGate } from './nicknameGateContext'

/**
 * 「닉네임을 정해 주세요」 대화상자 하나를 쥐고, 안쪽 화면(안내 띠)이 같은 대화상자를 연다. 로그인한 구역에만 둔다.
 * 글쓰기 전 확인(`author/useProfileGate`)도 같은 대화상자(`useNicknameDialog`)를 연다 — 닉네임을 정하는 길은 하나다
 */
export function NicknameGateProvider({ children }: { children: ReactNode }) {
  const { open, dialog } = useNicknameDialog()
  const gate = useMemo<NicknameGate>(() => ({ open }), [open])
  return (
    <NicknameGateContext.Provider value={gate}>
      {children}
      {dialog}
    </NicknameGateContext.Provider>
  )
}
