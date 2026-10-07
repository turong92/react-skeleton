import { describe, expect, it } from 'vitest'
import { reserveBottomSpace, type SpaceTarget } from './reserveSpace'

const target = (): SpaceTarget => ({
  body: { style: { paddingBottom: '8px' } },
  root: { style: { scrollPaddingBottom: '' } },
})

describe('reserveBottomSpace', () => {
  it('pads the page and the scroll port by the banner height, so content and focus never end up under it', () => {
    const t = target()
    reserveBottomSpace(t, 180)
    expect(t.body.style.paddingBottom).toBe('calc(8px + 180px)')
    expect(t.root.style.scrollPaddingBottom).toBe('180px')
  })

  it('follows the banner when it grows (the categories open) and gives everything back when it goes away', () => {
    const t = target()
    const space = reserveBottomSpace(t, 180)
    space.set(300)
    expect(t.body.style.paddingBottom).toBe('calc(8px + 300px)')
    expect(t.root.style.scrollPaddingBottom).toBe('300px')
    space.release()
    expect(t.body.style.paddingBottom).toBe('8px')
    expect(t.root.style.scrollPaddingBottom).toBe('')
  })
})

describe('reserveBottomSpace without an existing padding', () => {
  it('uses the plain height', () => {
    const t: SpaceTarget = {
      body: { style: { paddingBottom: '' } },
      root: { style: { scrollPaddingBottom: '' } },
    }
    reserveBottomSpace(t, 120)
    expect(t.body.style.paddingBottom).toBe('120px')
  })
})
