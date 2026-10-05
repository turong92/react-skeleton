import * as uiBarrel from '@skeleton/ui'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { uiEntries } from './uiEntries'
import { UiPage } from './UiPage'

afterEach(() => vi.restoreAllMocks())

const isComponent = (name: string, value: unknown) =>
  /^[A-Z]/.test(name) && typeof value === 'function'

describe('the UI gallery registry', () => {
  it('has an entry for every component @skeleton/ui exports — a new one cannot be forgotten', () => {
    const exported = Object.entries(uiBarrel)
      .filter(([name, value]) => isComponent(name, value))
      .map(([name]) => name)
    expect(exported.length).toBeGreaterThan(10)
    const missing = exported.filter((name) => !uiEntries.some((entry) => entry.name === name))
    expect(missing, 'add an entry to apps/showcase/src/ui/entries/*.tsx').toEqual([])
  })

  it('also shows the helper functions that are not components', () => {
    expect(uiEntries.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(['showApiError', 'toastPromise']),
    )
  })

  it('every entry is a real export with a short title and its import line', () => {
    for (const entry of uiEntries) {
      expect(entry.name in uiBarrel, entry.name).toBe(true)
      expect(entry.title.length, entry.name).toBeGreaterThan(0)
      expect(entry.importLine, entry.name).toContain(`import { ${entry.name} } from '@skeleton/ui'`)
    }
    expect(new Set(uiEntries.map((entry) => entry.name)).size).toBe(uiEntries.length)
  })

  it('shows states, not just a default: disabled, error, loading, sizes and variants', () => {
    const html = renderToString(
      <MemoryRouter>
        <UiPage />
      </MemoryRouter>,
    )
    for (const needle of [
      'disabled',
      'aria-invalid="true"',
      'aria-busy="true"',
      'data-size="sm"',
      'data-variant="danger"',
    ])
      expect(html).toContain(needle)
  })

  it('renders on the server without throwing or React warnings', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    for (const entry of uiEntries)
      expect(renderToString(<div>{entry.render()}</div>).length, entry.name).toBeGreaterThan(0)
    expect(errors.mock.calls).toEqual([])
  })
})
