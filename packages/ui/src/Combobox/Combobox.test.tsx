import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Combobox } from './Combobox'

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
]

describe('Combobox', () => {
  it('is an editable combobox with a list popup, closed on first render', () => {
    const html = renderToStaticMarkup(
      <Combobox selected={null} onSelect={() => undefined} options={options} />,
    )
    expect(html).toContain('role="combobox"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-autocomplete="list"')
    expect(html).toContain('aria-haspopup="listbox"')
    expect(html).not.toContain('role="listbox"')
    expect(html).not.toContain('aria-activedescendant')
  })

  it('shows the selected option label in the input', () => {
    const html = renderToStaticMarkup(
      <Combobox selected={options[1]} onSelect={() => undefined} options={options} />,
    )
    expect(html).toContain('value="Beta"')
  })

  it('takes the Field wiring (id, describedby, invalid) and a placeholder', () => {
    const html = renderToStaticMarkup(
      <Combobox
        id="city"
        aria-describedby="hint"
        invalid
        placeholder="Pick a city"
        selected={null}
        onSelect={() => undefined}
        options={options}
      />,
    )
    expect(html).toContain('id="city"')
    expect(html).toContain('aria-describedby="hint"')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('placeholder="Pick a city"')
  })

  it('has a polite live region for loading / empty / count messages', () => {
    const html = renderToStaticMarkup(
      <Combobox selected={null} onSelect={() => undefined} options={options} />,
    )
    expect(html).toMatch(/role="status"/)
  })
})
