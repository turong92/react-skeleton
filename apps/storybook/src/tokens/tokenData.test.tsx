import { resolveTokens } from '@skeleton/tokens/build'
import tokensJson from '@skeleton/tokens/tokens.json'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { readSemanticTokens, THEME_NAMES } from './tokenData'
import { TokensPage } from './TokensPage'

describe('tokenData — browser-safe reading of tokens.json', () => {
  const real = resolveTokens(tokensJson).filter((token) => token.layer === 'semantic')
  const mine = readSemanticTokens()

  it('has the same semantic tokens, in the same order, as the generator', () => {
    expect(mine.map((token) => token.cssName)).toEqual(real.map((token) => token.cssName))
  })

  it('resolves every value per theme exactly as the generator does', () => {
    expect([...THEME_NAMES]).toEqual(['light', 'dark'])
    for (const token of real) {
      const found = mine.find((m) => m.cssName === token.cssName)!
      expect(found.values.light, token.cssName).toBe(token.resolved)
      expect(found.values.dark, token.cssName).toBe(token.byTheme.dark.resolved)
    }
  })
})

describe('TokensPage', () => {
  const html = renderToStaticMarkup(<TokensPage />)

  it('shows light and dark side by side in themed containers', () => {
    expect(html).toContain('data-theme="light"')
    expect(html).toContain('data-theme="dark"')
  })

  it('shows swatches with name and value in both themes', () => {
    const bg = readSemanticTokens().find((token) => token.cssName === '--bg')!
    expect(html).toContain('--bg')
    expect(html).toContain(bg.values.light)
    expect(html).toContain(bg.values.dark)
  })

  it('has spacing, radius, type scale and shadow sections', () => {
    for (const heading of ['Colors', 'Spacing', 'Radius', 'Type scale', 'Shadows'])
      expect(html).toContain(heading)
    expect(html).toContain('--space-md')
    expect(html).toContain('--radius-md')
    expect(html).toContain('--font-size-body')
    expect(html).toContain('--shadow')
  })
})
