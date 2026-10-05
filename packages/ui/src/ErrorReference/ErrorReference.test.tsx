import { ApiRequestError } from '@skeleton/api-client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ErrorReference } from './ErrorReference'
import { errorReferenceOf } from './errorReferenceOf'

function apiError(traceId: string) {
  return new ApiRequestError(
    {
      code: 'COMMON.INTERNAL_ERROR',
      title: 'Something went wrong',
      status: 500,
      timestamp: '2026-01-01T00:00:00Z',
      traceId,
    },
    traceId,
    'bbbbbbbbbbbbbbbb',
    'tp',
  )
}

describe('errorReferenceOf', () => {
  it('is the traceId of an ApiRequestError', () => {
    expect(errorReferenceOf(apiError('abc123'))).toBe('abc123')
  })

  it.each([new Error('x'), 'text', null, undefined, {}])('is undefined for %p', (value) => {
    expect(errorReferenceOf(value)).toBeUndefined()
  })
})

describe('ErrorReference', () => {
  it('shows the label, the reference and a copy button with English defaults', () => {
    const html = renderToStaticMarkup(<ErrorReference reference="abc123" />)
    expect(html).toContain('Reference')
    expect(html).toContain('<code')
    expect(html).toContain('abc123')
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>Copy<\/button>/)
  })

  it('takes the reference from an error', () => {
    expect(renderToStaticMarkup(<ErrorReference error={apiError('trace-9')} />)).toContain(
      'trace-9',
    )
  })

  it('renders nothing when there is no reference (a plain Error, no props)', () => {
    expect(renderToStaticMarkup(<ErrorReference error={new Error('x')} />)).toBe('')
    expect(renderToStaticMarkup(<ErrorReference />)).toBe('')
  })

  it('every visible word is a prop', () => {
    const html = renderToStaticMarkup(
      <ErrorReference reference="r1" label="문의 번호" copyLabel="복사" copiedLabel="복사했어요" />,
    )
    expect(html).toContain('문의 번호')
    expect(html).toContain('>복사</button>')
    expect(html).not.toContain('Copy')
    expect(html).not.toContain('Reference')
  })

  it('has a polite status region for the copied message, empty until copied', () => {
    const html = renderToStaticMarkup(<ErrorReference reference="r1" />)
    expect(html).toMatch(/<span[^>]*role="status"[^>]*><\/span>/)
  })

  it('the button is described by the reference so a screen reader hears what is copied', () => {
    const html = renderToStaticMarkup(<ErrorReference reference="r1" />)
    const id = /<code[^>]*id="([^"]+)"/.exec(html)?.[1]
    expect(id).toBeTruthy()
    expect(html).toContain(`aria-describedby="${id}"`)
  })
})
