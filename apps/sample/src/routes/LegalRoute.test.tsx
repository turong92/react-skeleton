import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { legalKeys } from '@skeleton/legal'
import { i18n } from '../i18n'
import { LegalRoute } from './LegalRoute'

const render = (client: QueryClient, doc: 'terms' | 'privacy') =>
  renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/${doc}`]}>
        <LegalRoute doc={doc} />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const summary = (type: string) => ({
  type,
  locale: 'ko',
  version: 'srv-1',
  effectiveFrom: '2026-10-01T00:00:00Z',
  title: '서버 이용약관',
  sha256: 'x',
  required: true,
  requiredAtSignUp: true,
  template: false,
  next: null,
})

describe('/terms and /privacy prefer the backend’s documents and keep the static files for backend-less sites', () => {
  it('the backend lists the document → the backend text is shown (not the file)', () => {
    const client = new QueryClient()
    client.setQueryData(legalKeys.documents(), [summary('terms')])
    client.setQueryData(legalKeys.document('terms', { version: undefined, locale: 'ko' }), {
      type: 'terms',
      version: 'srv-1',
      locale: 'ko',
      effectiveFrom: '2026-10-01T00:00:00Z',
      current: true,
      template: false,
      title: '서버 이용약관',
      sha256: 'x',
      required: true,
      requiredAtSignUp: true,
      markdown: '# 서버 본문\n\n서버가 준 문서',
    })
    const html = render(client, 'terms')
    expect(html).toContain('서버 이용약관')
    expect(html).toContain('서버가 준 문서')
    expect(html).not.toContain(i18n.t('legal.templateNotice'))
  })

  it('the backend has no such document (or no legal module) → the static template file page', async () => {
    const client = // retryOnMount: false — a failed list is not asked again while rendering (in the browser it is, and ends here too)
      new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } })
    await client.prefetchQuery({
      queryKey: legalKeys.documents(),
      queryFn: () => Promise.reject(new Error('404')),
    })
    expect(render(client, 'terms')).toContain(i18n.t('legal.templateNotice'))
    const other = new QueryClient()
    other.setQueryData(legalKeys.documents(), [summary('privacy')]) // terms is not offered by the server
    expect(render(other, 'terms')).toContain(i18n.t('legal.templateNotice'))
  })
})
