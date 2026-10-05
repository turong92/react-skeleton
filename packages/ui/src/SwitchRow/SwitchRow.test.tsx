import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SwitchRow } from './SwitchRow'

const noop = () => undefined
const input = (html: string) => /<input[^>]*>/.exec(html)![0]

describe('SwitchRow', () => {
  it('is one label around the title, the description and a role="switch" checkbox (the whole row toggles)', () => {
    const html = renderToStaticMarkup(
      <SwitchRow title="Email" description="A weekly summary" checked={false} onChange={noop} />,
    )
    expect(html).toMatch(/^<label[^>]*>/)
    expect(input(html)).toContain('type="checkbox"')
    expect(input(html)).toContain('role="switch"')
    expect(html).toContain('Email')
    expect(html).toContain('A weekly summary')
  })

  it('is named by the title only and described by the description', () => {
    const html = renderToStaticMarkup(
      <SwitchRow title="Email" description="A weekly summary" checked onChange={noop} />,
    )
    const labelledBy = /aria-labelledby="([^"]+)"/.exec(input(html))?.[1]
    const describedBy = /aria-describedby="([^"]+)"/.exec(input(html))?.[1]
    expect(html).toContain(`id="${labelledBy}"`)
    expect(html).toContain(`id="${describedBy}"`)
    expect(labelledBy).not.toBe(describedBy)
  })

  it('reflects checked, disabled, busy and invalid on the control', () => {
    const html = renderToStaticMarkup(
      <SwitchRow title="x" checked disabled busy invalid onChange={noop} />,
    )
    expect(input(html)).toContain('checked=""')
    expect(input(html)).toContain('disabled=""')
    expect(input(html)).toContain('aria-busy="true"')
    expect(input(html)).toContain('aria-invalid="true"')
  })

  it('busy does not disable the control (focus stays) and has no description id when none is given', () => {
    const html = renderToStaticMarkup(<SwitchRow title="x" checked={false} busy onChange={noop} />)
    expect(input(html)).not.toContain('disabled')
    expect(input(html)).not.toContain('aria-describedby')
  })

  it('describedBy adds an external id (an error message, a lock reason) after the description', () => {
    const html = renderToStaticMarkup(
      <SwitchRow title="x" description="d" describedBy="err-1" checked={false} onChange={noop} />,
    )
    expect(input(html)).toMatch(/aria-describedby="[^"]+ err-1"/)
  })
})
