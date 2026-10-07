import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AuthorProfileManager } from './AuthorProfileManager'
import { defaultAuthorProfileLabels as L } from './labels'
import { authorProfileKeys } from './queries'
import { profile, stubApi } from './test/fixtures'

const api = stubApi()
function render(profiles: ReturnType<typeof profile>[], max = 3) {
  const client = new QueryClient()
  client.setQueryData(authorProfileKeys.list(), profiles)
  client.setQueryData(authorProfileKeys.config(), { maxPerAccount: max, nameMaxLength: 60 })
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AuthorProfileManager api={api} />
    </QueryClientProvider>,
  )
}

describe('AuthorProfileManager', () => {
  it('lists every profile as name#tag in a labelled list, with the count against the limit', () => {
    const html = render([profile('prf_a', 'Ann', '0001'), profile('prf_b', 'Bea', '0002')])
    expect(html).toContain(`aria-label="${L.listLabel}"`)
    expect(html).toContain('Ann')
    expect(html).toContain('#0002')
    expect(html).toContain(L.count(2, 3))
    expect(html.match(/<li/g)).toHaveLength(2)
  })

  it('every row has a Rename and a Delete that LOOK like buttons and name their row for a screen reader', () => {
    const html = render([profile('prf_a', 'Ann', '0001')])
    expect(html).toContain(`aria-label="${L.rename('Ann#0001')}"`)
    expect(html).toContain(`aria-label="${L.remove('Ann#0001')}"`)
    expect(html).toContain(`>${L.renameAction}<`)
    expect(html).toContain(`>${L.removeAction}<`)
  })

  it('at the limit: the add button is off and the limit is explained up front', () => {
    const html = render(
      [profile('prf_a', 'Ann'), profile('prf_b', 'Bea', '0002'), profile('prf_c', 'Cy', '0003')],
      3,
    )
    expect(html).toContain(L.limitReached(3))
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[^<]*(<[^>]+>)*[^<]*Add profile/)
  })

  it('under the limit there is no limit sentence; an empty list says so', () => {
    const html = render([], 3)
    expect(html).not.toContain(L.limitReached(3))
    expect(html).toContain(L.empty)
  })

  it('draws no ids at all: no profile id, no account id', () => {
    const html = render([profile('prf_a', 'Ann')])
    expect(html).not.toContain('prf_')
    expect(html).not.toContain('acc_')
  })

  it('the delete confirmation is closed until asked for', () => {
    const html = render([profile('prf_a', 'Ann')])
    expect(html).not.toContain(L.deleteDescription('Ann#0001'))
  })
})
