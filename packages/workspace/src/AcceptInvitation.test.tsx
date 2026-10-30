import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AcceptInvitation } from './AcceptInvitation'
import { defaultWorkspaceLabels as L } from './labels'
import { stubApi } from './test/fixtures'
import { memoryStorage } from './test/memoryStorage'

describe('AcceptInvitation on the server', () => {
  it('reads nothing from the address or the tab until it is in the browser — it draws the loading placeholder and calls no api', () => {
    let called = false
    const api = stubApi({
      previewInvitation: async () => {
        called = true
        throw new Error('no')
      },
    })
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <AcceptInvitation
          api={api}
          signedIn={false}
          onSignIn={() => {}}
          onAccepted={() => {}}
          storage={memoryStorage({ 'skeleton.workspace.invitation': 'secret-token' })}
        />
      </QueryClientProvider>,
    )
    expect(html).toContain(L.loading)
    expect(html).not.toContain('secret-token')
    expect(called).toBe(false)
  })
})
