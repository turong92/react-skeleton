import { Alert, Button } from '@skeleton/ui'
import { useMemo, type ReactNode } from 'react'
import { defaultWaitingRoomLabels, type WaitingRoomLabels } from './labels'
import { EntryContext } from './entryContext'
import { useWaitingRoom } from './useWaitingRoom'
import type { WaitingRoomApi } from './waitingRoomApi'
import type { WaitingRoomStorage } from './waitingRoomQueue'
import { WaitingScreen } from './WaitingScreen'

export type WaitingRoomGateProps = {
  api: WaitingRoomApi
  roomId: string
  storage?: WaitingRoomStorage
  labels?: WaitingRoomLabels
  /** 입장한 뒤에 그려진다 */
  children: ReactNode
}

/**
 * 페이지 앞 문 - 입장하기 전에는 대기 화면(오픈 전 줄 포함), 입장하면 `children`.
 * 입장 시간이 끝나도 children 은 그대로 둔다(하던 일을 마칠 수 있게) - 입장권만 거두고 「다시 줄 서기」 띠를 붙인다.
 */
export function WaitingRoomGate({
  api,
  roomId,
  storage,
  labels = defaultWaitingRoomLabels,
  children,
}: WaitingRoomGateProps) {
  const room = useWaitingRoom(roomId, { api, storage, autoJoin: true })
  const status = room.status
  const entryToken = status?.state === 'ADMITTED' ? (status.entryToken ?? null) : null
  const entry = useMemo(() => ({ entryToken }), [entryToken])
  if (status?.state === 'ADMITTED' || status?.state === 'EXPIRED') {
    return (
      <EntryContext.Provider value={entry}>
        {status.state === 'EXPIRED' && (
          <Alert
            tone="warning"
            action={<Button onClick={room.rejoin}>{labels.screen.rejoin}</Button>}
          >
            {labels.entryExpired}
          </Alert>
        )}
        {children}
      </EntryContext.Provider>
    )
  }
  return (
    <WaitingScreen
      status={status}
      failed={room.error !== null}
      onRejoin={room.rejoin}
      labels={labels}
    />
  )
}
