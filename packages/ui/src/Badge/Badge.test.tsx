import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Badge } from './Badge'

describe('Badge', () => {
  it('shows its text and defaults to the neutral tone', () => {
    expect(renderToStaticMarkup(<Badge>Draft</Badge>)).toMatch(/data-tone="neutral"[^>]*>Draft</)
  })

  it.each(['info', 'success', 'warning', 'danger'] as const)(
    'tone %s is a data attribute',
    (tone) => {
      expect(renderToStaticMarkup(<Badge tone={tone}>x</Badge>)).toContain(`data-tone="${tone}"`)
    },
  )
})
