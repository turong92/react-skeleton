import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AudioEngine } from './audioEngine'
import type { QueueItem } from './playQueue'
import { createQueueController } from './queueController'
import { QueueContext, usePlayQueue } from './usePlayQueue'

const item = (id: string): QueueItem => ({ kind: 'youtube', id, title: id, videoId: `v${id}` })

function read(items: QueueItem[], startId?: string) {
  const audio = { loadedItem: () => null, setVolume: () => {} } as unknown as AudioEngine
  const controller = createQueueController({ audio, random: () => 0 })
  controller.setQueue(items, { startId })
  let seen: ReturnType<typeof usePlayQueue> | undefined
  const Probe = () => {
    seen = usePlayQueue()
    return null
  }
  renderToStaticMarkup(
    <QueueContext value={controller}>
      <Probe />
    </QueueContext>,
  )
  return seen!
}

describe('usePlayQueue', () => {
  it('tells the position of the current song in the play order, -1 when there is none', () => {
    expect(read([item('a'), item('b'), item('c')], 'b').currentIndex).toBe(1)
    expect(read([]).currentIndex).toBe(-1)
  })

  it('gives volume, muted and setters, and does not claim to set volume on the server (unknown until the browser measures)', () => {
    const q = read([item('a')])
    expect(q).toMatchObject({ volume: 1, muted: false, canSetVolume: false })
    expect(typeof q.setVolume).toBe('function')
    expect(typeof q.setMuted).toBe('function')
  })
})
