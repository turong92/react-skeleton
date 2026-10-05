import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { toastPromise, type ToastLike } from './toastPromise'

function fakeToast() {
  const calls: Array<[string, string, unknown]> = []
  const toast: ToastLike = {
    loading: (message, options) => (calls.push(['loading', message, options]), 'toast-1'),
    success: (message, options) => (calls.push(['success', message, options]), 'toast-1'),
    error: (message, options) => (calls.push(['error', message, options]), 'toast-1'),
  }
  return { toast, calls }
}

const apiError = () =>
  new ApiRequestError(
    {
      code: 'COMMON.NOT_FOUND',
      title: 'Not found',
      status: 404,
      detail: 'no such item',
      timestamp: 't',
    },
    'trace-1',
    'span-1',
    '00-t-s-01',
  )

describe('toastPromise — loading → success / error in one toast', () => {
  it('shows loading, then replaces the same toast with the success message, and returns the value', async () => {
    const { toast, calls } = fakeToast()
    const result = await toastPromise(
      Promise.resolve(41),
      { loading: 'Saving…', success: 'Saved' },
      toast,
    )
    expect(result).toBe(41)
    expect(calls.map(([kind, message]) => [kind, message])).toEqual([
      ['loading', 'Saving…'],
      ['success', 'Saved'],
    ])
    expect(calls[1][2]).toMatchObject({ id: 'toast-1' })
  })

  it('the success message can be computed from the value', async () => {
    const { toast, calls } = fakeToast()
    await toastPromise(Promise.resolve(3), { loading: 'x', success: (n) => `${n} items` }, toast)
    expect(calls[1][1]).toBe('3 items')
  })

  it('on failure replaces the toast with the error (title + detail for an ApiRequestError) and rethrows', async () => {
    const { toast, calls } = fakeToast()
    const failure = apiError()
    await expect(
      toastPromise(Promise.reject(failure), { loading: 'x', success: 'y' }, toast),
    ).rejects.toBe(failure)
    expect(calls[1][0]).toBe('error')
    expect(calls[1][1]).toBe('Not found')
    expect(calls[1][2]).toMatchObject({ id: 'toast-1', description: 'no such item' })
  })

  it('an explicit error message wins, and a plain Error falls back to its message', async () => {
    const own = fakeToast()
    await expect(
      toastPromise(
        Promise.reject(new Error('boom')),
        { loading: 'x', success: 'y', error: 'Could not save' },
        own.toast,
      ),
    ).rejects.toThrow('boom')
    expect(own.calls[1][1]).toBe('Could not save')
    const plain = fakeToast()
    await expect(
      toastPromise(Promise.reject(new Error('boom')), { loading: 'x', success: 'y' }, plain.toast),
    ).rejects.toThrow()
    expect(plain.calls[1][1]).toBe('boom')
  })
})
