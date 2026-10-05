import { describe, expect, it, vi } from 'vitest'
import type { TurnstileApi, TurnstileRenderOptions } from './types'
import { createTurnstileWidget } from './widget'

function fakeApi() {
  const calls: string[] = []
  let options: TurnstileRenderOptions | undefined
  const api: TurnstileApi = {
    render: (_container, opts) => {
      calls.push('render')
      options = opts
      return 'widget-1'
    },
    reset: (id) => void calls.push(`reset:${id}`),
    remove: (id) => void calls.push(`remove:${id}`),
  }
  return { api, calls, options: () => options! }
}
const container = {} as HTMLElement

describe('createTurnstileWidget', () => {
  it('renders into the container with the site key and maps the widget callbacks to ours', async () => {
    const { api, options } = fakeApi()
    const onToken = vi.fn()
    const onExpire = vi.fn()
    const onError = vi.fn()
    createTurnstileWidget({
      loader: async () => api,
      container,
      siteKey: 'site-1',
      action: 'login',
      theme: 'dark',
      onToken,
      onExpire,
      onError,
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(options()).toMatchObject({ sitekey: 'site-1', action: 'login', theme: 'dark' })
    options().callback!('tok-1')
    options()['expired-callback']!()
    options()['error-callback']!('300030')
    expect(onToken).toHaveBeenCalledWith('tok-1')
    expect(onExpire).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith('300030')
  })

  it('reset asks the widget for a fresh token (tokens are single-use — reset after a failed submit)', async () => {
    const { api, calls } = fakeApi()
    const widget = createTurnstileWidget({
      loader: async () => api,
      container,
      siteKey: 's',
      onToken: () => {},
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    widget.reset()
    expect(calls).toEqual(['render', 'reset:widget-1'])
  })

  it('destroy removes the widget; after destroy callbacks and reset do nothing', async () => {
    const { api, calls, options } = fakeApi()
    const onToken = vi.fn()
    const widget = createTurnstileWidget({
      loader: async () => api,
      container,
      siteKey: 's',
      onToken,
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    widget.destroy()
    options().callback!('late')
    widget.reset()
    expect(onToken).not.toHaveBeenCalled()
    expect(calls).toEqual(['render', 'remove:widget-1'])
  })

  it('destroying before the script has loaded renders nothing at all', async () => {
    const { api, calls } = fakeApi()
    let release!: () => void
    const loader = () => new Promise<TurnstileApi>((resolve) => (release = () => resolve(api)))
    const widget = createTurnstileWidget({ loader, container, siteKey: 's', onToken: () => {} })
    widget.destroy()
    release()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls).toEqual([])
  })

  it('a loader failure goes to onError (the page decides what to tell the user)', async () => {
    const onError = vi.fn()
    createTurnstileWidget({
      loader: async () => {
        throw new Error('blocked by an ad blocker')
      },
      container,
      siteKey: 's',
      onToken: () => {},
      onError,
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(onError).toHaveBeenCalledWith('script-load-failed')
  })
})
