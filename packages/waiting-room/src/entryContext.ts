import { createContext, useContext } from 'react'

export type WaitingRoomEntry = {
  /** 입장권 - 입장 시간이 끝났거나 문 밖이면 null */
  entryToken: string | null
}

export const EntryContext = createContext<WaitingRoomEntry>({ entryToken: null })

/** 문 안에서 입장권을 읽는다 - 자리를 더하는 요청마다 `createEntryHeaders(entryToken)` 로 보낸다 */
export function useWaitingRoomEntry(): WaitingRoomEntry {
  return useContext(EntryContext)
}
