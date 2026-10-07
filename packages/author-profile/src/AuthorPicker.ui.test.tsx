import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AuthorPicker, AuthorPickerView } from './AuthorPicker'
import { createAuthorMemory } from './authorMemory'
import { defaultAuthorProfileLabels } from './labels'
import { authorProfileKeys } from './queries'
import { profile, stubApi } from './test/fixtures'

const profiles = [profile('prf_a', 'Ann', '0001'), profile('prf_b', 'Bea', '0002')]
const noop = () => undefined
const view = {
  profiles,
  boardCode: 'free',
  labels: defaultAuthorProfileLabels,
  onChange: noop,
  threadAuthorId: undefined,
  threadLoading: false,
  invalid: false,
  disabled: false,
  onUnsettledChange: noop,
}

describe('AuthorPickerView — the folded state', () => {
  it('shows exactly one name#tag: the chosen one; the other profile is not in the page until the list is opened', () => {
    const html = renderToStaticMarkup(<AuthorPickerView {...view} value="prf_a" />)
    expect(html).toContain('Ann')
    expect(html).toContain('#0001')
    expect(html).not.toContain('Bea')
    expect(html).not.toContain('role="menu"')
    expect(html).toContain('aria-expanded="false"')
  })

  it('with nothing chosen it is a button that looks pressable and says so ("Choose a nickname")', () => {
    const html = renderToStaticMarkup(<AuthorPickerView {...view} value={undefined} />)
    expect(html).toContain(defaultAuthorProfileLabels.choose)
    expect(html).toContain('<button')
    expect(html).not.toContain('Ann')
    expect(html).not.toContain('Bea')
  })

  it('never writes an account id: the memory key stays in storage, not in the page', () => {
    const memory = createAuthorMemory(undefined, 'acc_secret_123')
    memory.set('free', 'prf_a')
    const html = renderToStaticMarkup(<AuthorPickerView {...view} value="prf_a" memory={memory} />)
    expect(html).not.toContain('acc_')
    expect(html).not.toContain('secret')
  })

  it('no profiles at all → a "Create a nickname" button calling the app\'s entry, not an empty menu', () => {
    const html = renderToStaticMarkup(
      <AuthorPickerView {...view} profiles={[]} value={undefined} onCreateProfile={noop} />,
    )
    expect(html).toContain(defaultAuthorProfileLabels.createProfile)
    expect(html).not.toContain('aria-haspopup="menu"') // 열 목록이 없다
    expect(html).not.toContain('aria-haspopup') // 기본은 화면 이동 등 — 창을 연다고 말하지 않는다
  })

  it('"Create a nickname" says it opens a dialog when the app opens one (createOpensDialog)', () => {
    const html = renderToStaticMarkup(
      <AuthorPickerView
        {...view}
        profiles={[]}
        value={undefined}
        onCreateProfile={noop}
        createOpensDialog
      />,
    )
    expect(html).toContain('aria-haspopup="dialog"')
  })

  it('the trigger carries the chosen name in its accessible name, and the invalid state reaches the markup', () => {
    const html = renderToStaticMarkup(<AuthorPickerView {...view} value="prf_b" invalid />)
    expect(html).toContain(`aria-label="${defaultAuthorProfileLabels.triggerLabel('Bea#0002')}"`)
    expect(html).toContain('data-invalid="true"')
  })

  it('ties the form error to the trigger with aria-describedby (a screen reader reads the error on the picker)', () => {
    const html = renderToStaticMarkup(
      <AuthorPickerView {...view} value={undefined} invalid aria-describedby="err-1" />,
    )
    expect(html).toMatch(/<button[^>]*aria-describedby="err-1"/)
    const empty = renderToStaticMarkup(
      <AuthorPickerView
        {...view}
        profiles={[]}
        value={undefined}
        onCreateProfile={noop}
        aria-describedby="err-2"
      />,
    )
    expect(empty).toMatch(/<button[^>]*aria-describedby="err-2"/)
    expect(renderToStaticMarkup(<AuthorPickerView {...view} value="prf_a" />)).not.toContain(
      'aria-describedby',
    )
  })

  it('while the thread is still loading and nothing is chosen, the button says so and is locked (visible text = accessible name)', () => {
    const html = renderToStaticMarkup(
      <AuthorPickerView {...view} value={undefined} threadLoading />,
    )
    expect(html).toContain(`aria-label="${defaultAuthorProfileLabels.threadLoading}"`)
    expect(html).toContain(`>${defaultAuthorProfileLabels.threadLoading}<`)
    expect(html).toContain('aria-disabled="true"')
  })

  it('a chosen name stays visible while the thread reloads, only locked', () => {
    const html = renderToStaticMarkup(<AuthorPickerView {...view} value="prf_a" threadLoading />)
    expect(html).toContain('Ann')
    expect(html).toContain('aria-disabled="true"')
    expect(html).not.toContain(defaultAuthorProfileLabels.threadLoading)
  })

  it('an unnamed or tagless profile reads naturally: no "null", no empty "#"', () => {
    const odd = [
      { id: 'prf_n', name: null, tag: null, createdAt: '2026-01-01T00:00:00Z' },
      { id: 'prf_t', name: 'Ann', tag: null, createdAt: '2026-01-01T00:00:00Z' },
    ]
    const unnamed = renderToStaticMarkup(
      <AuthorPickerView {...view} profiles={odd} value="prf_n" />,
    )
    expect(unnamed).toContain(defaultAuthorProfileLabels.unnamed)
    expect(unnamed).not.toContain('null')
    expect(unnamed).not.toContain('#')
    const tagless = renderToStaticMarkup(
      <AuthorPickerView {...view} profiles={odd} value="prf_t" />,
    )
    expect(tagless).toContain('Ann')
    expect(tagless).not.toContain('#')
  })

  it('shows no standing warning about other profiles (a warning that is always there is itself a leak)', () => {
    const html = renderToStaticMarkup(
      <AuthorPickerView {...view} value="prf_b" threadAuthorId="prf_a" />,
    )
    expect(html).not.toContain('role="status"')
    expect(html).not.toContain('Ann')
  })
})

describe('AuthorPicker — connected to the list query', () => {
  it('draws from the cached list; before it arrives, a disabled loading button', () => {
    const client = new QueryClient()
    const api = stubApi({ list: async () => profiles })
    const loading = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <AuthorPicker
          api={api}
          boardCode="free"
          value={undefined}
          onChange={noop}
          threadAuthorId={undefined}
          threadLoading={false}
          onUnsettledChange={noop}
          invalid={false}
          disabled={false}
        />
      </QueryClientProvider>,
    )
    expect(loading).toContain(defaultAuthorProfileLabels.loading)
    expect(loading).toContain('disabled')

    client.setQueryData(authorProfileKeys.list(), profiles)
    const ready = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <AuthorPicker
          api={api}
          boardCode="free"
          value="prf_b"
          onChange={noop}
          threadAuthorId={undefined}
          threadLoading={false}
          onUnsettledChange={noop}
          invalid={false}
          disabled={false}
        />
      </QueryClientProvider>,
    )
    expect(ready).toContain('Bea')
    expect(ready).not.toContain('Ann')
  })
})
