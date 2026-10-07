import { useMemo, useState, type ReactNode } from 'react'
import { NicknameDialog } from './NicknameDialog'
import { NicknameGateContext, type NicknameGate } from './nicknameGateContext'

/**
 * 닉네임 대화상자 하나를 쥐고, 안쪽 화면(안내 띠)이 같은 대화상자를 연다. 로그인한 구역에만 둔다.
 * 계정 이름은 나만 보는 이름이라 글 · 댓글을 쓰기 전에 요구하지 않는다 — 쓰기 전 확인은 프로필의 몫이다(`author/useProfileGate`)
 */
export function NicknameGateProvider({ children }: { children: ReactNode }) {
  const [opened, setOpened] = useState(false)
  const gate = useMemo<NicknameGate>(() => ({ open: () => setOpened(true) }), [])
  return (
    <NicknameGateContext.Provider value={gate}>
      {children}
      <NicknameDialog open={opened} onClose={() => setOpened(false)} />
    </NicknameGateContext.Provider>
  )
}
