import { ApiRequestError } from '@skeleton/api-client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createCurrentWorkspace } from './currentWorkspace'
import { defaultWorkspaceLabels as L } from './labels'
import { workspaceKeys } from './queries'
import { detail, stubApi } from './test/fixtures'
import { useWorkspace } from './workspaceContext'
import { WorkspaceProvider } from './WorkspaceProvider'

const Probe = () => {
  const workspace = useWorkspace()
  return <p>{workspace ? `${workspace.name}|${workspace.id}|${workspace.role}` : 'no workspace'}</p>
}

const failure = (status: number) =>
  new ApiRequestError({ code: 'WORKSPACE.NOT_FOUND', title: 'x', status } as never, 't', 's', 'p')

function render(client: QueryClient, slug = 'acme') {
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <WorkspaceProvider api={stubApi()} slug={slug} current={createCurrentWorkspace()}>
        <Probe />
      </WorkspaceProvider>
    </QueryClientProvider>,
  )
}
// retryOnMount 를 끈다: 켜 두면 실패한 쿼리를 다시 마운트하는 렌더는(서버 렌더 포함) 「다시 가져오는 중」으로 그려진다
const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } })

describe('WorkspaceProvider', () => {
  it('draws its children with the workspace the address resolved to', () => {
    const client = newClient()
    client.setQueryData(workspaceKeys.bySlug('acme'), detail())
    expect(render(client)).toContain('Acme|ws_1|OWNER')
  })

  it('draws nothing of the app while the address is still being resolved (no request may go out without the team header)', () => {
    const html = render(newClient())
    expect(html).not.toContain('no workspace')
    expect(html).not.toContain('Acme')
    expect(html).toContain(L.loading)
  })

  it('an old address still draws the app — the canonical address is swapped by the app via onCanonicalSlug', () => {
    const client = newClient()
    client.setQueryData(workspaceKeys.bySlug('old-name'), detail({ slug: 'new-name' }))
    expect(render(client, 'old-name')).toContain('Acme|ws_1|OWNER')
  })

  it('a 404 draws "not found" and none of the app (missing, not a member and closed look the same)', async () => {
    const client = newClient()
    const api = stubApi({
      bySlug: async () => {
        throw failure(404)
      },
    })
    await client.prefetchQuery({
      queryKey: workspaceKeys.bySlug('acme'),
      queryFn: () => api.bySlug('acme'),
    })
    const html = render(client)
    expect(html).toContain(L.notFound.title)
    expect(html).not.toContain('Acme|')
  })

  it('another failure draws a retry, not "not found"', async () => {
    const client = newClient()
    await client.prefetchQuery({
      queryKey: workspaceKeys.bySlug('acme'),
      queryFn: async () => {
        throw failure(500)
      },
    })
    const html = render(client)
    expect(html).toContain(L.loadFailed)
    expect(html).toContain(`>${L.retry}<`)
    expect(html).not.toContain(L.notFound.title)
  })
})

describe('useWorkspace', () => {
  it('is null outside a provider (the first screen, the team list)', () => {
    expect(renderToStaticMarkup(<Probe />)).toContain('no workspace')
  })
})
