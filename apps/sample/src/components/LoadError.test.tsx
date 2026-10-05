import { ApiRequestError } from '@skeleton/api-client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { LoadError } from './LoadError'

const serverError = new ApiRequestError(
  {
    code: 'COMMON.INTERNAL_ERROR',
    title: 'Internal error',
    status: 500,
    timestamp: 't',
    traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
  },
  '4bf92f3577b34da6a3ce929d0e0e4736',
  'span',
  'tp',
)

describe('LoadError', () => {
  afterEach(() => i18n.setLocale('ko', { remember: false }))

  it('shows the reference number of an API error (the toast is gone by now) with a copy button', () => {
    const html = renderToStaticMarkup(<LoadError error={serverError} onRetry={() => {}} />)
    expect(html).toContain('문의 번호')
    expect(html).toContain('4bf92f3577b34da6a3ce929d0e0e4736')
    expect(html).toContain('>복사</button>')
  })

  it('shows no reference for an error that has none (a network failure)', () => {
    const html = renderToStaticMarkup(<LoadError error={new TypeError('x')} onRetry={() => {}} />)
    expect(html).not.toContain('문의 번호')
  })

  it('speaks English when the language is English', async () => {
    await i18n.setLocale('en', { remember: false })
    const html = renderToStaticMarkup(<LoadError error={serverError} onRetry={() => {}} />)
    expect(html).toContain('Reference number')
    expect(html).toContain('>Copy</button>')
  })
})
