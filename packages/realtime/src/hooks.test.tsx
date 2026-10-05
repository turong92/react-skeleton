import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { useNotificationSocket } from './useNotificationSocket'
import { useSseClient } from './useSseClient'

describe('realtime hooks', () => {
  it('useSseClient starts idle with no events and does not connect on its own', () => {
    const fetchStub = vi.fn()
    function Probe() {
      const sse = useSseClient({
        url: 'http://api.test/sse',
        onEvent: () => {},
        fetch: fetchStub as unknown as typeof fetch,
      })
      return (
        <p>
          {sse.status}:{sse.events.length}:{typeof sse.start}:{typeof sse.stop}
        </p>
      )
    }
    expect(renderToStaticMarkup(<Probe />)).toBe('<p>idle:0:function:function</p>')
    expect(fetchStub).not.toHaveBeenCalled()
  })

  it('useNotificationSocket starts idle with no messages and does not open a socket on its own', () => {
    const factory = vi.fn()
    function Probe() {
      const socket = useNotificationSocket({
        url: 'ws://api.test/ws/notifications',
        getAccessToken: () => 'tok',
        webSocketFactory: factory,
      })
      return (
        <p>
          {socket.status}:{socket.messages.length}:{typeof socket.start}:{typeof socket.stop}
        </p>
      )
    }
    expect(renderToStaticMarkup(<Probe />)).toBe('<p>idle:0:function:function</p>')
    expect(factory).not.toHaveBeenCalled()
  })
})
