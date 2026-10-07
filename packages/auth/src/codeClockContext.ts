import { createContext, useContext } from 'react'

export const CodeClockContext = createContext<() => number>(() => Date.now())

/** 인증번호 남은 시간을 세는 시계 — 안 넣으면 기기 시계. 넣는 법은 `CodeClockProvider` */
export function useCodeClock(): () => number {
  return useContext(CodeClockContext)
}
