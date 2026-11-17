import { describe, expect, it } from 'vitest'
import { GPT_SCRIPT_SRC, loadGoogletag } from './googletag'
import type { GoogletagLike } from './googletag'

type FakeScript = { src: string; onload: null | (() => void); onerror: null | (() => void) }

function fakeEnv() {
  const scripts: FakeScript[] = []
  const win: { googletag?: Partial<GoogletagLike> } = {}
  const env = {
    window: win,
    document: {
      createElement: () => ({ src: '', onload: null, onerror: null }) as FakeScript,
      head: { appendChild: (script: FakeScript) => void scripts.push(script) },
    },
  }
  return { env: env as unknown as NonNullable<Parameters<typeof loadGoogletag>[0]>, scripts, win }
}

describe('loadGoogletag', () => {
  it('adds the GPT script once for concurrent callers and resolves with window.googletag', async () => {
    const { env, scripts, win } = fakeEnv()
    const first = loadGoogletag(env)
    const second = loadGoogletag(env)
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toBe(GPT_SCRIPT_SRC)
    win.googletag = { cmd: [] }
    scripts[0].onload!()
    expect(await first).toBe(win.googletag)
    expect(await second).toBe(win.googletag)
  })

  it('rejects without a browser', async () => {
    await expect(loadGoogletag({ window: undefined, document: undefined })).rejects.toThrow(
      /browser/,
    )
  })
})
