import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koVideoPlayerLabels } from './labels'
import type { PlaybackEnv } from './playbackPlan'
import { fakeGrant } from './test/grant'
import { VideoPlayer } from './VideoPlayer'

const native: PlaybackEnv = { canPlayType: () => true, mse: null }
const none: PlaybackEnv = { canPlayType: () => false, mse: null }

describe('VideoPlayer before the first press', () => {
  it('shows the poster and an enabled play button that names the length, and no video file is touched', () => {
    const html = renderToStaticMarkup(<VideoPlayer grant={fakeGrant()} env={native} />)
    expect(html).toContain('src="https://cdn.test/v/a/p-1.jpg"')
    expect(html).toMatch(/<button[^>]*aria-label="Play video, 0:42"/)
    expect(html).not.toContain('disabled')
    expect(html).not.toContain('<video')
    expect(html).not.toContain('m3u8')
  })

  it('says it is being prepared, with a disabled button, when nothing playable exists yet', () => {
    const html = renderToStaticMarkup(
      <VideoPlayer
        grant={fakeGrant({ hls: undefined, compat: undefined, codec: 'hvc1.1.6.L153.B0' })}
        env={{ canPlayType: (m) => m === 'application/vnd.apple.mpegurl', mse: null }}
      />,
    )
    expect(html).toContain('Getting your video ready')
    expect(html).toMatch(/<button[^>]*disabled/)
  })

  it('tells the viewer when the browser cannot play video of this kind at all', () => {
    const html = renderToStaticMarkup(<VideoPlayer grant={fakeGrant()} env={none} />)
    expect(html).toContain('This browser cannot play this video')
    expect(html).toMatch(/<button[^>]*disabled/)
  })

  it('writes the labels it is given', () => {
    const html = renderToStaticMarkup(
      <VideoPlayer grant={fakeGrant()} env={native} labels={koVideoPlayerLabels} />,
    )
    expect(html).toContain('aria-label="영상 재생, 0:42"')
  })

  it('reserves the picture shape from the grant so nothing jumps', () => {
    const html = renderToStaticMarkup(
      <VideoPlayer grant={fakeGrant({ w: 1080, h: 1920 })} env={native} />,
    )
    expect(html).toContain('aspect-ratio:1080/1920')
  })
})
