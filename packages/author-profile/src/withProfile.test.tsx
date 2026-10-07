import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { withProfile } from './withProfile'

const parts = { name: 'Ann', tag: '0001' }
const html = (node: ReturnType<typeof withProfile>) => renderToStaticMarkup(<>{node}</>)

describe('withProfile — a translated "(name) => sentence" with the name slot filled by name + fixed tag', () => {
  it('keeps the text before and after the name, in order, with the name box in between', () => {
    const out = html(withProfile((name) => `Use ${name} anyway`, parts))
    expect(out.startsWith('Use ')).toBe(true)
    expect(out.endsWith(' anyway')).toBe(true)
    expect(out).toContain('Ann')
    expect(out).toContain('#0001')
    expect(out.indexOf('Ann')).toBeLessThan(out.indexOf('#0001'))
  })

  it('a sentence with no name slot is returned as plain text', () => {
    expect(withProfile(() => 'Cancel', parts)).toBe('Cancel')
  })

  it('a name used twice is filled twice (no marker character is left in the page)', () => {
    const out = html(withProfile((name) => `${name} and again ${name}`, parts))
    expect(out.match(/#0001/g)).toHaveLength(2)
    expect(out).not.toContain('\u0001')
  })

  it('no tag → no "#" box at all', () => {
    const out = html(withProfile((name) => `Keep ${name}`, { name: 'Ann', tag: null }))
    expect(out).not.toContain('#')
    expect(out).toContain('Ann')
  })

  it('the template is called with a marker only — never with the real name', () => {
    const seen: string[] = []
    withProfile((name) => {
      seen.push(name)
      return name
    }, parts)
    expect(seen).toHaveLength(1)
    expect(seen[0]).not.toContain('Ann')
  })
})
