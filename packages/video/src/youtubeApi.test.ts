import { describe, expect, it, vi } from 'vitest'
import {
  createYouTubeLoader,
  watchReady,
  youtubePlayerVars,
  youtubeHandlers,
  YT_ERROR_CODES,
  type YouTubeApi,
} from './youtubeApi'

function fakeWorld(initial: { YT?: unknown; onYouTubeIframeAPIReady?: () => void } = {}) {
  const scripts: Array<{ src: string; onerror: (() => void) | null }> = []
  const win: Record<string, unknown> = { ...initial }
  const doc = {
    createElement: () => {
      const script = { src: '', onerror: null as (() => void) | null }
      scripts.push(script)
      return script
    },
    head: { appendChild: vi.fn() },
  }
  const api = {
    Player: class {},
    PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
  } as unknown as YouTubeApi
  const ready = () => {
    win.YT = api
    ;(win.onYouTubeIframeAPIReady as () => void)()
  }
  return { win, doc, scripts, api, ready }
}

describe('createYouTubeLoader', () => {
  it('loads nothing until a youtube item asks for it', () => {
    const w = fakeWorld()
    createYouTubeLoader(() => ({ win: w.win, doc: w.doc }) as never)
    expect(w.scripts).toHaveLength(0)
  })

  it('adds the IFrame API script once and resolves when YouTube calls back', async () => {
    const w = fakeWorld()
    const load = createYouTubeLoader(() => ({ win: w.win, doc: w.doc }) as never)
    const first = load()
    const second = load()
    expect(w.scripts).toHaveLength(1)
    expect(w.scripts[0]!.src).toBe('https://www.youtube.com/iframe_api')
    w.ready()
    await expect(first).resolves.toBe(w.api)
    await expect(second).resolves.toBe(w.api)
  })

  it('uses the API straight away when the page already has it', async () => {
    const w = fakeWorld()
    w.win.YT = w.api
    const load = createYouTubeLoader(() => ({ win: w.win, doc: w.doc }) as never)
    await expect(load()).resolves.toBe(w.api)
    expect(w.scripts).toHaveLength(0)
  })

  it('still calls a ready callback somebody else had set', async () => {
    const other = vi.fn()
    const w = fakeWorld({ onYouTubeIframeAPIReady: other })
    const load = createYouTubeLoader(() => ({ win: w.win, doc: w.doc }) as never)
    const loaded = load()
    w.ready()
    await loaded
    expect(other).toHaveBeenCalled()
  })

  it('rejects when the script cannot load, and tries again the next time', async () => {
    const w = fakeWorld()
    const load = createYouTubeLoader(() => ({ win: w.win, doc: w.doc }) as never)
    const failed = load()
    w.scripts[0]!.onerror!()
    await expect(failed).rejects.toThrow()
    const again = load()
    expect(w.scripts).toHaveLength(2)
    w.ready()
    await expect(again).resolves.toBe(w.api)
  })

  it('rejects when the script never answers', async () => {
    vi.useFakeTimers()
    const w = fakeWorld()
    const load = createYouTubeLoader(() => ({ win: w.win, doc: w.doc }) as never, 5000)
    const pending = load()
    const caught = expect(pending).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(5001)
    await caught
    vi.useRealTimers()
  })
})

describe('youtubeHandlers', () => {
  function setup() {
    const calls: string[] = []
    const handlers = youtubeHandlers(
      { ENDED: 0, PLAYING: 1, PAUSED: 2 },
      {
        onEnded: () => calls.push('ended'),
        onFailed: () => calls.push('failed'),
        onPlaying: (playing) => calls.push(playing ? 'playing' : 'paused'),
      },
    )
    return { handlers, calls }
  }

  it('maps the player states to ended / playing / paused', () => {
    const { handlers, calls } = setup()
    handlers.onStateChange({ data: 1 })
    handlers.onStateChange({ data: 2 })
    handlers.onStateChange({ data: 0 })
    handlers.onStateChange({ data: 3 }) // 버퍼링 - 아무것도 알리지 않는다
    expect(calls).toEqual(['playing', 'paused', 'ended'])
  })

  it('treats every error code as a failure (not embeddable, removed, private, bad id ...)', () => {
    for (const code of YT_ERROR_CODES) {
      const { handlers, calls } = setup()
      handlers.onError({ data: code })
      expect(calls).toEqual(['failed'])
    }
    expect(YT_ERROR_CODES).toEqual(expect.arrayContaining([2, 5, 100, 101, 150]))
  })

  it('treats an error code nobody listed as a failure too', () => {
    const { handlers, calls } = setup()
    handlers.onError({ data: 999 })
    expect(calls).toEqual(['failed'])
  })
})

describe('watchReady', () => {
  it('calls back when the player never gets ready in time', () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn()
    watchReady(onTimeout, 5000)
    vi.advanceTimersByTime(5001)
    expect(onTimeout).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('stays quiet once the player is ready (or the stage went away)', () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn()
    const stop = watchReady(onTimeout, 5000)
    stop()
    vi.advanceTimersByTime(10_000)
    expect(onTimeout).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('youtubePlayerVars', () => {
  it('autoplays only when asked, and keeps the frame play controls by default', () => {
    expect(youtubePlayerVars(true, true)).toEqual({
      autoplay: 1,
      controls: 1,
      playsinline: 1,
      rel: 0,
    })
    expect(youtubePlayerVars(false, true)).toMatchObject({ autoplay: 0, controls: 1 })
  })

  it("turns the frame's own controls off when the app draws its own", () => {
    expect(youtubePlayerVars(true, false)).toMatchObject({ controls: 0 })
  })
})
