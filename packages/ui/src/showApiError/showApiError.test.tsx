import { ApiRequestError } from '@skeleton/api-client'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const toastError = vi.fn()
const toastSuccess = vi.fn()
vi.mock('sonner', () => ({ toast: { error: toastError, success: toastSuccess } }))

const { showApiError } = await import('./showApiError')

function apiError() {
  return new ApiRequestError(
    {
      code: 'COMMON.VALIDATION_FAILED',
      title: 'Validation failed',
      status: 400,
      detail: 'email format invalid',
      timestamp: '2026-06-12T00:00:00Z',
    },
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'bbbbbbbbbbbbbbbb',
    'tp',
  )
}

beforeEach(() => {
  toastError.mockClear()
  toastSuccess.mockClear()
})

describe('showApiError', () => {
  it('shows the ApiError title with detail, traceId and spanId', () => {
    const error = new ApiRequestError(
      {
        ...apiError().apiError,
        traceId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        spanId: 'bbbbbbbbbbbbbbbb',
      },
      't',
      's',
      'tp',
    )
    showApiError(error)
    expect(toastError).toHaveBeenCalledTimes(1)
    const [title, options] = toastError.mock.calls[0]
    expect(title).toBe('Validation failed')
    const body = renderToStaticMarkup(options.description)
    expect(body).toContain('email format invalid')
    expect(body).toContain('traceId')
    expect(body).toContain('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    expect(body).toContain('spanId: bbbbbbbbbbbbbbbb')
  })

  it('shows a plain Error as its message', () => {
    showApiError(new Error('oops'))
    expect(toastError).toHaveBeenCalledWith('oops')
  })

  it('stringifies anything else', () => {
    showApiError('just text')
    expect(toastError).toHaveBeenCalledWith('just text')
  })

  it('the hover hint on the traceId is a message with an English default and can be translated', () => {
    const withTrace = new ApiRequestError(
      { ...apiError().apiError, traceId: 'abc' },
      't',
      's',
      'tp',
    )
    showApiError(withTrace)
    expect(renderToStaticMarkup(toastError.mock.calls[0][1].description)).toContain(
      'title="Click to copy"',
    )
    showApiError(withTrace, { messages: { clickToCopy: '클릭하여 복사' } })
    expect(renderToStaticMarkup(toastError.mock.calls[1][1].description)).toContain(
      'title="클릭하여 복사"',
    )
  })

  it('returns the reference (traceId) so the caller can keep showing it after the toast is gone', () => {
    const error = new ApiRequestError(
      { ...apiError().apiError, traceId: 'trace-keep' },
      'trace-keep',
      's',
      'tp',
    )
    expect(showApiError(error)).toBe('trace-keep')
    expect(showApiError(new Error('oops'))).toBeUndefined()
    expect(showApiError('text')).toBeUndefined()
  })

  it('the traceId in the toast is a keyboard-reachable copy button, not a click-only div', () => {
    const withTrace = new ApiRequestError(
      { ...apiError().apiError, traceId: 'abc' },
      'abc',
      's',
      'tp',
    )
    showApiError(withTrace, { messages: { copy: '복사', traceIdCopied: '복사했어요' } })
    const body = renderToStaticMarkup(toastError.mock.calls[0][1].description)
    expect(body).toMatch(/<button[^>]*type="button"[^>]*>복사<\/button>/)
  })
})
