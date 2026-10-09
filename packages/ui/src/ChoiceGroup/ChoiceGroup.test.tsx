import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ChoiceGroup } from './ChoiceGroup'

const options = [
  { value: 'a', label: 'Small' },
  { value: 'b', label: 'Medium' },
  { value: 'c', label: 'Large' },
]
const render = (value: string | null, extra: { disabled?: boolean } = {}) =>
  renderToStaticMarkup(
    <ChoiceGroup
      aria-label="Size"
      options={options}
      value={value}
      onChange={() => undefined}
      {...extra}
    />,
  )

describe('ChoiceGroup', () => {
  it('is a radio group with one real button per choice (they are pressable, not bare words)', () => {
    const html = render('b')
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain('aria-label="Size"')
    expect(html.match(/<button[^>]*role="radio"/g)).toHaveLength(3)
    for (const option of options) expect(html).toContain(option.label)
  })

  it('is named by a visible label elsewhere when given aria-labelledby (the same words are not read twice)', () => {
    const html = renderToStaticMarkup(
      <ChoiceGroup aria-labelledby="legend-1" options={options} value="a" onChange={() => {}} />,
    )
    expect(html).toContain('aria-labelledby="legend-1"')
    expect(html).not.toContain('aria-label=')
  })

  it('says which one is chosen in words for assistive technology and with a check mark for everyone (not colour alone)', () => {
    const html = render('b')
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1)
    expect(html.match(/aria-checked="false"/g)).toHaveLength(2)
    expect(html.match(/✓/g)).toHaveLength(1)
    const chosen = html.match(/<button[^>]*aria-checked="true"[^>]*>(.*?)<\/button>/)?.[1] ?? ''
    expect(chosen).toContain('Medium')
    expect(chosen).toContain('✓')
  })

  it('only the chosen one is a Tab stop; with nothing chosen the first is', () => {
    expect(render('b').match(/tabindex="0"/g)).toHaveLength(1)
    expect(render('b')).toMatch(
      /aria-checked="true"[^>]*tabindex="0"|tabindex="0"[^>]*aria-checked="true"/,
    )
    expect(render(null).match(/tabindex="0"/g)).toHaveLength(1)
    expect(render(null)).toMatch(/<button[^>]*tabindex="0"[^>]*>Small/)
  })

  it('a locked group stays reachable — it is not removed from the page', () => {
    const html = render('b', { disabled: true })
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(3)
    expect(html).not.toMatch(/<button[^>]*\sdisabled/)
  })
})
