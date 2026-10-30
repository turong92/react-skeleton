import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { defaultWorkspaceLabels as L } from './labels'
import { workspaceKeys } from './queries'
import { stubApi, summary } from './test/fixtures'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

function render(
  currentSlug: string | undefined,
  list = [summary(), summary({ id: 'ws_2', name: 'Globex', slug: 'globex' })],
) {
  const client = new QueryClient()
  client.setQueryData(workspaceKeys.list(), list)
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <WorkspaceSwitcher api={stubApi()} currentSlug={currentSlug} onSelect={() => {}} />
    </QueryClientProvider>,
  )
}

describe('WorkspaceSwitcher', () => {
  it('shows the current team by name on a real button whose spoken name contains it', () => {
    const html = render('globex')
    expect(html).toContain(`aria-label="${L.switcher.trigger('Globex')}"`)
    expect(html).toContain('>Globex<')
    expect(html).toMatch(/<button[^>]*aria-haspopup="menu"/)
  })

  it('without a current team (the first screen) it asks to choose', () => {
    const html = render(undefined)
    expect(html).toContain(`aria-label="${L.switcher.trigger(undefined)}"`)
    expect(html).toContain(`>${L.switcher.choose}<`)
  })

  it('while the list is loading the button is there but locked, and says so', () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceSwitcher api={stubApi()} currentSlug="acme" onSelect={() => {}} />
      </QueryClientProvider>,
    )
    expect(html).toContain('aria-disabled="true"')
    expect(html).toContain(L.switcher.loading)
  })
})
