import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MiniPlayerView } from './MiniPlayer'
import type { QueueItem } from './playQueue'
import { koPlayQueueLabels } from './queueLabels'

const item: QueueItem = {
  kind: 'media',
  id: 'a',
  title: 'Song A',
  artist: 'Artist',
  thumb: 'https://cdn.test/a.jpg',
  source: { src: '/a.m3u8', audio: '/a-audio.m3u8' },
}
const noop = () => {}

describe('MiniPlayerView', () => {
  it('shows the thumbnail, title and artist with play and next buttons', () => {
    const html = renderToStaticMarkup(
      <MiniPlayerView item={item} playing={false} onToggle={noop} onNext={noop} />,
    )
    expect(html).toContain('src="https://cdn.test/a.jpg"')
    expect(html).toContain('Song A')
    expect(html).toContain('Artist')
    expect(html).toContain('aria-label="Play"')
    expect(html).toContain('aria-label="Next song"')
    expect(html).toContain('aria-label="Now playing"')
  })

  it('turns the play button into pause while playing', () => {
    const html = renderToStaticMarkup(
      <MiniPlayerView item={item} playing onToggle={noop} onNext={noop} />,
    )
    expect(html).toContain('aria-label="Pause"')
    expect(html).not.toContain('aria-label="Play"')
  })

  it('makes the info area a real button that opens the big screen when the app wants that', () => {
    const html = renderToStaticMarkup(
      <MiniPlayerView item={item} playing={false} onToggle={noop} onNext={noop} onOpen={noop} />,
    )
    expect(html).toMatch(/<button[^>]*aria-label="Open Song A"/)
  })

  it('leaves the info area as plain text when there is nowhere to open', () => {
    const html = renderToStaticMarkup(
      <MiniPlayerView item={item} playing={false} onToggle={noop} onNext={noop} />,
    )
    expect(html).not.toContain('Open Song A')
  })

  it('draws a placeholder when there is no thumbnail, and writes the labels it is given', () => {
    const html = renderToStaticMarkup(
      <MiniPlayerView
        item={{ ...item, thumb: undefined, artist: undefined }}
        playing={false}
        labels={koPlayQueueLabels}
        onToggle={noop}
        onNext={noop}
      />,
    )
    expect(html).not.toContain('<img')
    expect(html).toContain('aria-label="재생"')
    expect(html).toContain('aria-label="다음 곡"')
  })
})
