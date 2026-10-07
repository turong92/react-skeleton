import { useMemo, useState, type ReactNode } from 'react'
import { NICKNAME_BEFORE_WRITE } from './authConfig'
import { NicknameDialog } from './NicknameDialog'
import { NicknameGateContext, type NicknameGate } from './nicknameGateContext'
import { needsNickname } from './profileDisplay'
import { useMyProfile } from './useMyProfile'

/** 닉네임 대화상자 하나를 쥐고, 안쪽 화면(안내 띠 · 게시판)이 같은 대화상자를 연다. 로그인한 구역에만 둔다 */
export function NicknameGateProvider({ children }: { children: ReactNode }) {
  const me = useMyProfile()
  const [opened, setOpened] = useState(false)
  const gate = useMemo<NicknameGate>(
    () => ({
      open: () => setOpened(true),
      ensure: () => {
        if (!NICKNAME_BEFORE_WRITE || !needsNickname(me.data)) return true
        setOpened(true)
        return false
      },
    }),
    [me.data],
  )
  return (
    <NicknameGateContext.Provider value={gate}>
      {children}
      <NicknameDialog open={opened} onClose={() => setOpened(false)} />
    </NicknameGateContext.Provider>
  )
}
