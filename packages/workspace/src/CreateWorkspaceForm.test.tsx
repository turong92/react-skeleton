import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CreateWorkspaceForm } from './CreateWorkspaceForm'
import { defaultWorkspaceLabels as L } from './labels'
import { stubApi } from './test/fixtures'

const render = (props: { onCancel?: () => void } = {}) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <CreateWorkspaceForm api={stubApi()} onCreated={() => {}} {...props} />
    </QueryClientProvider>,
  )

describe('CreateWorkspaceForm', () => {
  const html = render()

  it('has a labelled name field (required) and a labelled address field with its rule as the hint', () => {
    expect(html).toMatch(new RegExp(`<label[^>]*>${L.form.nameLabel}`))
    expect(html).toMatch(new RegExp(`<label[^>]*>${L.form.slugLabel}`))
    expect(html).toContain(L.form.slugHint)
    expect(html.match(/<input/g)).toHaveLength(2)
  })

  it('submits with a real button; cancel is there only when the app can leave the form', () => {
    expect(html).toContain(`>${L.create.submit}<`)
    expect(html).not.toContain(`>${L.cancel}<`)
    const withCancel = render({ onCancel: () => {} })
    expect(withCancel).toContain(`>${L.cancel}<`)
  })
})
