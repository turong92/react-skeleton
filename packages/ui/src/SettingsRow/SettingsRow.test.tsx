import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SettingsGroup, SettingsRow } from './SettingsRow'

describe('SettingsRow', () => {
  it('puts the name, the current value and the action in one row, and the note under it', () => {
    const html = renderToStaticMarkup(
      <SettingsRow label="Password" value="In use" action={<button>Change</button>}>
        <p>Saved</p>
      </SettingsRow>,
    )
    expect(html.indexOf('Password')).toBeLessThan(html.indexOf('In use'))
    expect(html.indexOf('In use')).toBeLessThan(html.indexOf('Change'))
    expect(html.indexOf('Change')).toBeLessThan(html.indexOf('Saved'))
  })

  it('a group is a titled card with the anchor id', () => {
    const html = renderToStaticMarkup(
      <SettingsGroup id="security" title="Security">
        <SettingsRow label="Password" />
      </SettingsGroup>,
    )
    expect(html).toMatch(/<section[^>]*id="security"/)
    expect(html).toContain('id="security-title"')
  })
})
