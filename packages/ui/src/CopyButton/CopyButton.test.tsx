import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CopyButton } from './CopyButton'
import { copyText } from './copyText'

describe('copyText', () => {
  it('uses the async clipboard when there is one', async () => {
    const written: string[] = []
    const ok = await copyText('hello', {
      clipboard: {
        writeText: async (text: string) => {
          written.push(text)
        },
      },
    })
    expect(ok).toBe(true)
    expect(written).toEqual(['hello'])
  })

  it('reports failure (never throws) when the clipboard rejects or is missing', async () => {
    expect(
      await copyText('x', {
        clipboard: {
          writeText: async () => {
            throw new Error('denied')
          },
        },
      }),
    ).toBe(false)
    expect(await copyText('x', {})).toBe(false)
  })
})

describe('CopyButton', () => {
  it('is a button named by its label, with a polite live region that starts empty', () => {
    const html = renderToStaticMarkup(<CopyButton value="abc" label="Copy link" />)
    expect(html).toContain('type="button"')
    expect(html).toContain('Copy link')
    expect(html).toMatch(/role="status"[^>]*><\/span>|aria-live="polite"[^>]*><\/span>/)
  })

  it('never puts the copied value in the markup', () => {
    expect(renderToStaticMarkup(<CopyButton value="secret-token" label="Copy" />)).not.toContain(
      'secret-token',
    )
  })
})
