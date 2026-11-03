import { Button } from '@skeleton/ui'
import { useState } from 'react'
import { koWaitingRoomLabels } from '../labels'
import type { WaitingRoomStatus } from '../types'
import { useWaitingRoom } from '../useWaitingRoom'
import { useWaitingRoomEntry } from '../entryContext'
import { WaitingRoomGate } from '../WaitingRoomGate'
import { WaitingScreen } from '../WaitingScreen'
import { createFakeWaitingRoom, memoryStorage } from './fakeWaitingRoom'

/* 스토리용 화면 - 가짜 서버를 스토리를 열 때 한 번만 만들고, 앱이 하는 일은 `role="status"` 줄(`log`)에 적어 play 가 읽는다. */

function Entered() {
  const { entryToken } = useWaitingRoomEntry()
  return <p>입장한 화면 (입장권: {entryToken ?? '없음'})</p>
}

/** 페이지 앞 문 - 순번이 오기 전엔 대기 화면, 오면 children */
export function PageGateDemo({ script }: { script: WaitingRoomStatus[] }) {
  const [{ api }] = useState(() => createFakeWaitingRoom(script))
  const [storage] = useState(memoryStorage)
  return (
    <WaitingRoomGate api={api} roomId="wr_1" storage={storage} labels={koWaitingRoomLabels}>
      <Entered />
    </WaitingRoomGate>
  )
}

/** 버튼 앞 문 - 누르면 줄을 서고, 입장권이 오면 앱이 하던 일을 이어 간다 */
export function ButtonGateDemo({ script }: { script: WaitingRoomStatus[] }) {
  const [{ api }] = useState(() => createFakeWaitingRoom(script))
  const [storage] = useState(memoryStorage)
  const room = useWaitingRoom('wr_1', { api, storage })
  const [log, setLog] = useState('')
  const enter = async () => {
    try {
      setLog(`entered:${await room.enter()}`)
    } catch (error) {
      setLog(`failed:${error instanceof Error ? error.message : 'unknown'}`)
    }
  }
  return (
    <div>
      <Button onClick={() => void enter()}>예약하기</Button>
      {room.started && room.status?.state !== 'ADMITTED' && (
        <WaitingScreen
          status={room.status}
          failed={room.error !== null}
          onRejoin={room.rejoin}
          labels={koWaitingRoomLabels}
        />
      )}
      <p role="status" aria-label="log">
        {log}
      </p>
    </div>
  )
}
