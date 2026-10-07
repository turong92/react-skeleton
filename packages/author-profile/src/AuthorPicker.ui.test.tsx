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
  invalid: false,
  disabled: false,
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

  it('with nothing chosen it is a button that looks pressable and says so ("Choose a profile")', () => {
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

  it('no profiles at all → a "Create a profile" button calling the app\'s entry, not an empty menu', () => {
    const html = renderToStaticMarkup(
      <AuthorPickerView {...view} profiles={[]} value={undefined} onCreateProfile={noop} />,
    )
    expect(html).toContain(defaultAuthorProfileLabels.createProfile)
    expect(html).not.toContain('aria-haspopup')
  })

  it('the trigger carries the chosen name in its accessible name, and the invalid state reaches the markup', () => {
    const html = renderToStaticMarkup(<AuthorPickerView {...view} value="prf_b" invalid />)
    expect(html).toContain(`aria-label="${defaultAuthorProfileLabels.triggerLabel('Bea#0002')}"`)
    expect(html).toContain('data-invalid="true"')
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
          invalid={false}
          disabled={false}
        />
      </QueryClientProvider>,
    )
    expect(ready).toContain('Bea')
    expect(ready).not.toContain('Ann')
  })
})
