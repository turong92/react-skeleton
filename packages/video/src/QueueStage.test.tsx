import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AudioEngine } from './audioEngine'
import type { QueueItem } from './playQueue'
import { createQueueController } from './queueController'
import { QueueStage } from './QueueStage'
import { QueueContext } from './usePlayQueue'

const engine = {
  setElement: () => {},
  element: () => null,
  wake: () => {},
  start: () => {},
  stop: () => {},
  pause: () => {},
  resume: () => {},
  restart: () => {},
  position: () => 0,
  loadedItem: () => null,
} as AudioEngine

function render(items: QueueItem[]) {
  const controller = createQueueController({ audio: engine })
  controller.setQueue(items)
  return renderToStaticMarkup(
    <QueueContext value={controller}>
      <QueueStage />
    </QueueContext>,
  )
}

describe('QueueStage', () => {
  it('draws nothing for an empty queue', () => {
    expect(render([])).toBe('')
  })

  it("draws the video player for one of our own videos, with no <audio> of its own (it borrows the queue's)", () => {
    const html = render([
      {
        kind: 'media',
        id: 'a',
        title: 'A',
        source: { src: '/a.m3u8', audio: '/a-audio.m3u8', poster: '/p.jpg' },
      },
    ])
    expect(html).toContain('src="/p.jpg"')
    expect(html).not.toContain('<audio')
  })

  it('draws the youtube frame host (and no video player, no switch) for a youtube item', () => {
    const html = render([{ kind: 'youtube', id: 'y', title: 'Y', videoId: 'abc123' }])
    expect(html).not.toContain('radiogroup')
    expect(html).not.toContain('<video')
    expect(html).toContain('aspect-ratio:16/9')
  })
})
