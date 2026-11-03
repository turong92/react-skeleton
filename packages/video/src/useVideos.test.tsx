import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { fakeItem } from './test/item'
import { useVideos, videosKey } from './useVideos'
import type { VideoApi } from './videoApi'

function Probe({ api }: { api: VideoApi }) {
  const { data, isPending } = useVideos(api, 'clip')
  return <p>{isPending ? 'loading' : data?.map((v) => v.id).join(',')}</p>
}

describe('useVideos', () => {
  it('reads the list of one purpose from the cache by purpose key', () => {
    const client = new QueryClient()
    client.setQueryData(videosKey('clip'), [fakeItem({ id: 'a' }), fakeItem({ id: 'b' })])
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <Probe api={{} as VideoApi} />
      </QueryClientProvider>,
    )
    expect(html).toContain('a,b')
    expect(videosKey('clip')).not.toEqual(videosKey('other'))
  })
})
