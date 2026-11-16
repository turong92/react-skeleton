import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koVideoPlayerLabels } from './labels'
import type { PlaybackEnv } from './playbackPlan'
import { fakeGrant } from './test/grant'
import { VideoPlayer } from './VideoPlayer'

const native: PlaybackEnv = { canPlayType: () => true, mse: null }
const none: PlaybackEnv = { canPlayType: () => false, mse: null }

describe('VideoPlayer before the first press', () => {
  it('names the play button after the sound in audio mode', () => {
    const html = renderToStaticMarkup(
      <VideoPlayer
        grant={fakeGrant({ audio: 'https://cdn.test/a.m3u8' })}
        env={native}
        initialMode="audio"
      />,
    )
    expect(html).toMatch(/<button[^>]*aria-label="Play audio"/)
  })

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

  it('has no video/audio switch and no audio element when the grant has no sound-only version', () => {
    const html = renderToStaticMarkup(<VideoPlayer grant={fakeGrant()} env={native} />)
    expect(html).not.toContain('radiogroup')
    expect(html).not.toContain('<audio')
  })

  it('shows the video/audio switch when the grant has a sound-only version, without fetching it yet', () => {
    const html = renderToStaticMarkup(
      <VideoPlayer
        grant={fakeGrant({ audio: 'https://cdn.test/v/a/a-1/index.m3u8' })}
        env={native}
      />,
    )
    expect(html).toContain('role="radiogroup"')
    expect(html).toMatch(
      /<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*>(?:<span[^>]*>[^<]*<\/span>)?Video/,
    )
    expect(html).toMatch(
      /<button[^>]*role="radio"[^>]*aria-checked="false"[^>]*>(?:<span[^>]*>[^<]*<\/span>)?Audio/,
    )
    expect(html).toContain('<audio')
    expect(html).not.toContain('a-1/index.m3u8') // 누르기 전에는 소리 판 주소도 안 쓴다
  })

  it("renders no audio element of its own when it borrows the queue's", () => {
    const host = {
      element: () => null,
      wake: () => {},
      start: () => {},
      stop: () => {},
      registerOutput: () => () => {},
      fullscreen: { register: () => () => {}, report: () => {} },
      status: () => null,
    }
    const html = renderToStaticMarkup(
      <VideoPlayer
        grant={fakeGrant({ audio: 'https://cdn.test/a.m3u8' })}
        env={native}
        audioHost={host}
      />,
    )
    expect(html).not.toContain('<audio')
    expect(html).toContain('role="radiogroup"')
  })

  it('joins a queue that is already playing this song as sound - no play button to press, Audio chosen', () => {
    const host = {
      element: () => null,
      wake: () => {},
      start: () => {},
      stop: () => {},
      registerOutput: () => () => {},
      fullscreen: { register: () => () => {}, report: () => {} },
      status: () => ({ playing: true, at: 42 }),
    }
    const html = renderToStaticMarkup(
      <VideoPlayer
        grant={fakeGrant({ audio: 'https://cdn.test/a.m3u8' })}
        env={native}
        audioHost={host}
      />,
    )
    expect(html).not.toContain('aria-label="Play video')
    expect(html).toMatch(
      /<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*>(?:<span[^>]*>[^<]*<\/span>)?Audio/,
    )
  })

  it('has no switch when this browser cannot play HLS at all', () => {
    const html = renderToStaticMarkup(
      <VideoPlayer grant={fakeGrant({ audio: 'https://cdn.test/a.m3u8' })} env={none} />,
    )
    expect(html).not.toContain('radiogroup')
  })

  it('starts in audio mode when the app asks for it', () => {
    const html = renderToStaticMarkup(
      <VideoPlayer
        grant={fakeGrant({ audio: 'https://cdn.test/a.m3u8' })}
        env={native}
        initialMode="audio"
      />,
    )
    expect(html).toMatch(
      /<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*>(?:<span[^>]*>[^<]*<\/span>)?Audio/,
    )
  })

  it('plays a bare source of same-origin addresses, with the sound switch when it has audio', () => {
    const html = renderToStaticMarkup(
      <VideoPlayer
        source={{
          src: '/media/a/index.m3u8',
          audio: '/media/a/audio.m3u8',
          poster: '/media/a/p.jpg',
        }}
        env={native}
      />,
    )
    expect(html).toContain('src="/media/a/p.jpg"')
    expect(html).toMatch(/<button[^>]*aria-label="Play video"/)
    expect(html).toContain('role="radiogroup"')
    expect(html).not.toContain('m3u8')
  })

  it('draws no poster image when a source has none', () => {
    const html = renderToStaticMarkup(
      <VideoPlayer source={{ src: '/media/a/index.m3u8' }} env={native} />,
    )
    expect(html).not.toContain('<img')
  })

  it('reserves the picture shape from the grant so nothing jumps', () => {
    const html = renderToStaticMarkup(
      <VideoPlayer grant={fakeGrant({ w: 1080, h: 1920 })} env={native} />,
    )
    expect(html).toContain('aspect-ratio:1080/1920')
  })
})
