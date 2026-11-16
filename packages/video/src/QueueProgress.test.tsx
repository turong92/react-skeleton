import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AudioEngine } from './audioEngine'
import { createQueueController } from './queueController'
import { koPlayQueueLabels } from './queueLabels'
import { QueueProgress, QueueProgressView } from './QueueProgress'
import { QueueContext } from './usePlayQueue'

const noop = () => {}

describe('QueueProgressView', () => {
  it('shows a range input with the time and the length beside it', () => {
    const html = renderToStaticMarkup(
      <QueueProgressView currentTime={12} duration={225} onSeek={noop} />,
    )
    expect(html).toMatch(/<input[^>]*type="range"/)
    expect(html).toContain('max="225"')
    expect(html).toContain('value="12"')
    expect(html).toContain('0:12')
    expect(html).toContain('3:45')
    expect(html).toContain('aria-label="Seek"')
    expect(html).toContain('aria-valuetext="0:12 / 3:45"')
  })

  it('is disabled while the length is unknown (0:00 / 0:00)', () => {
    const html = renderToStaticMarkup(
      <QueueProgressView currentTime={0} duration={0} onSeek={noop} />,
    )
    expect(html).toMatch(/<input[^>]*disabled/)
    expect(html).toContain('0:00')
  })

  it('writes the label it is given', () => {
    const html = renderToStaticMarkup(
      <QueueProgressView currentTime={1} duration={10} onSeek={noop} labels={koPlayQueueLabels} />,
    )
    expect(html).toContain(`aria-label="${koPlayQueueLabels.seek}"`)
  })
})

describe('QueueProgress', () => {
  it('draws nothing outside a PlayQueueProvider', () => {
    expect(renderToStaticMarkup(<QueueProgress />)).toBe('')
  })

  it('draws the idle bar for an empty queue on the server', () => {
    const controller = createQueueController({ audio: {} as AudioEngine })
    const html = renderToStaticMarkup(
      <QueueContext value={controller}>
        <QueueProgress />
      </QueueContext>,
    )
    expect(html).toContain('type="range"')
  })
})
