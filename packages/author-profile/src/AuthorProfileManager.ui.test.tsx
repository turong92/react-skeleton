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

  it('every row has a Rename and a Delete: real buttons with a visible word, named after their row for a screen reader', () => {
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
    // 꺼진 추가 단추와 칸이 그 이유 문장을 설명으로 가진다
    const id = html.match(/<p id="([^"]+)"[^>]*>[^<]*You can have up to 3 nicknames/)?.[1]
    expect(id).toBeTruthy()
    expect(html).toMatch(new RegExp(`<button[^>]*aria-describedby="${id}"[^>]*>`))
    expect(html).toMatch(new RegExp(`<input[^>]*aria-describedby="[^"]*${id}[^"]*"`))
    expect(html).not.toContain('Delete one')
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

  it('an unnamed or tagless profile row reads naturally and never prints "null"', () => {
    const html = render([profile('prf_n', null, null), profile('prf_t', 'Ann', null)])
    expect(html).toContain(L.unnamed)
    expect(html).toContain(`aria-label="${L.rename(L.unnamed)}"`)
    expect(html).toContain(`aria-label="${L.remove('Ann')}"`)
    expect(html).not.toContain('null')
    // 줄에는 꼬리표가 없다(설명 문장의 「#1234」 예시와 섞이지 않게 목록만 본다)
    expect(html.match(/<ul[\s\S]*<\/ul>/)?.[0]).not.toContain('#')
  })

  it('the delete confirmation is closed until asked for', () => {
    const html = render([profile('prf_a', 'Ann')])
    expect(html).not.toContain(L.deleteDescription('Ann#0001'))
  })
})
