import { describe, expect, it } from 'vitest'
import { safeReturnPath } from './returnTo'

describe('M5 — safeReturnPath only ever returns a same-origin path', () => {
  it.each([
    ['/\t/evil.example', 'tab (the URL parser drops it: becomes //evil.example)'],
    ['/\n/evil.example', 'newline'],
    ['/\r/evil.example', 'carriage return'],
    ['/\u0000/evil.example', 'NUL'],
    ['/\u007f/evil.example', 'DEL'],
    ['/\\evil.example', 'backslash right after the slash'],
    ['/ok\\..\\..\\evil', 'backslash anywhere'],
    ['//evil.example', 'protocol-relative'],
    ['///evil.example', 'triple slash'],
    ['https://evil.example/', 'absolute'],
    ['javascript:alert(1)', 'script scheme'],
    ['', 'empty'],
  ])('rejects %j (%s)', (value) => {
    expect(safeReturnPath(value, '/home')).toBe('/home')
  })

  it.each(['/', '/notes', '/notes?page=2#top', '/a%2Fb', '/%09/not-a-control-char', '/ünï/日本'])(
    'keeps the ordinary path %j',
    (value) => {
      expect(safeReturnPath(value, '/home')).toBe(value)
    },
  )

  it('non-strings fall back', () => {
    expect(safeReturnPath(undefined, '/home')).toBe('/home')
    expect(safeReturnPath({ pathname: '/x' }, '/home')).toBe('/home')
  })
})
