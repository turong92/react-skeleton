import {
  encodeStompFrame,
  nextNotificationReconnectDelay,
  parseSseBlock,
  parseStompFrames,
} from '@skeleton/realtime'
import { Case } from '../components/Section'

const SSE = 'id: e1\nevent: notification\ndata: {"title":"Hello","topic":"demo"}'
const FRAME = encodeStompFrame({
  command: 'SUBSCRIBE',
  headers: { id: 'sub-0', destination: '/topic/demo' },
})
const DELAYS = [1, 2, 3, 4, 5, 6].map(
  (attempt) => `${attempt}번째 → ${nextNotificationReconnectDelay(attempt)}ms`,
)

/** 연결 없이 — 프로토콜을 읽고 쓰는 순수 함수들. 연결은 `useSseClient` · `useNotificationSocket` 훅 */
export function RealtimeDemo() {
  return (
    <>
      <Case label="parseSseBlock(text)">
        <pre>
          <code>{JSON.stringify(parseSseBlock(SSE), null, 2)}</code>
        </pre>
      </Case>
      <Case label="encodeStompFrame → parseStompFrames">
        <pre>
          <code>{JSON.stringify(parseStompFrames(FRAME).frames, null, 2)}</code>
        </pre>
      </Case>
      <Case label="nextNotificationReconnectDelay(attempt)">
        <p>{DELAYS.join(' · ')}</p>
      </Case>
    </>
  )
}
