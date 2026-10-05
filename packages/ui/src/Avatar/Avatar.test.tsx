import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Avatar } from './Avatar'
import { initialsOf, toneOf } from './initials'

describe('initialsOf', () => {
  it.each([
    ['Ada Lovelace', 'AL'],
    ['ada', 'A'],
    ['  grace   brewster  hopper ', 'GB'],
    ['김수민', '김'],
    ['', '?'],
    ['   ', '?'],
    ['😀 Smile', '😀S'],
  ])('%j → %j', (name, initials) => expect(initialsOf(name)).toBe(initials))
})

describe('toneOf', () => {
  it('is deterministic per name and always one of the four tones', () => {
    expect(toneOf('Ada')).toBe(toneOf('Ada'))
    for (const name of ['', 'a', 'Ada', '김수민', 'x'.repeat(500)]) {
      expect(toneOf(name)).toBeGreaterThanOrEqual(0)
      expect(toneOf(name)).toBeLessThan(4)
    }
  })
})

describe('Avatar', () => {
  it('without a picture shows initials as an image named after the person', () => {
    const html = renderToStaticMarkup(<Avatar name="Ada Lovelace" />)
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Ada Lovelace"')
    expect(html).toContain('>AL<')
  })

  it('with a picture renders an <img> whose alt is the name (or the given alt)', () => {
    expect(renderToStaticMarkup(<Avatar name="Ada" src="/a.png" />)).toMatch(
      /<img[^>]*src="\/a.png"[^>]*alt="Ada"/,
    )
    expect(renderToStaticMarkup(<Avatar name="Ada" src="/a.png" alt="" />)).toContain('alt=""')
  })

  it('size is a data attribute (no inline pixels)', () => {
    expect(renderToStaticMarkup(<Avatar name="Ada" size="lg" />)).toContain('data-size="lg"')
  })
})
