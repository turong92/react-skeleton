import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LinkCard } from './LinkCard'

const render = () =>
  renderToStaticMarkup(
    <MemoryRouter>
      <LinkCard to="/account" description="Password, email">
        Manage account
      </LinkCard>
    </MemoryRouter>,
  )

describe('LinkCard', () => {
  it('is one link (the whole row is pressable) with an arrow that is not read aloud', () => {
    const html = render()
    expect(html.match(/<a /g)).toHaveLength(1)
    expect(html).toContain('href="/account"')
    expect(html).toMatch(/aria-hidden="true"[^>]*>→</)
  })

  it('says what is behind it in the same link', () => {
    const html = render()
    expect(html).toContain('Manage account')
    expect(html).toContain('Password, email')
  })
})
