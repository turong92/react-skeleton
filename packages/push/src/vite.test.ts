import { describe, expect, it } from 'vitest'
import { pushServiceWorker } from './vite'

type Middleware = (
  req: { url?: string },
  res: { setHeader(k: string, v: string): void; end(body: string): void },
  next: () => void,
) => void

describe('pushServiceWorker (Vite plugin)', () => {
  it('emits the worker at the build root, and the dev server answers the same address under the base', () => {
    const plugin = pushServiceWorker({ icon: '/icon.png' })
    const emitted: Array<{ fileName: string; source: string }> = []
    plugin.generateBundle.call({
      emitFile: (file: { fileName: string; source: string }) => void emitted.push(file),
      environment: { config: { consumer: 'client' } },
    })
    expect(emitted).toHaveLength(1)
    expect(emitted[0].fileName).toBe('push-sw.js')
    expect(emitted[0].source).toContain('showNotification')
    expect(emitted[0].source).toContain('/icon.png')

    let middleware: Middleware | undefined
    plugin.configResolved({ base: '/app/' })
    plugin.configureServer({
      middlewares: { use: (fn: Middleware) => void (middleware = fn) },
    })
    const served: Array<{ headers: Record<string, string>; body?: string }> = []
    const respond = () => {
      const entry: { headers: Record<string, string>; body?: string } = { headers: {} }
      served.push(entry)
      return {
        setHeader: (k: string, v: string) => void (entry.headers[k] = v),
        end: (body: string) => void (entry.body = body),
      }
    }
    let passed = 0
    middleware!({ url: '/app/push-sw.js?v=1' }, respond(), () => passed++)
    middleware!({ url: '/push-sw.js' }, respond(), () => passed++)
    expect(served[0].body).toBe(emitted[0].source)
    expect(served[0].headers['Content-Type']).toMatch(/javascript/)
    expect(served[1].body).toBeUndefined()
    expect(passed).toBe(1)
  })

  it('does not write into the server (SSR) bundle', () => {
    const plugin = pushServiceWorker()
    const emitted: unknown[] = []
    plugin.generateBundle.call({
      emitFile: (file: unknown) => void emitted.push(file),
      environment: { config: { consumer: 'server' } },
    })
    expect(emitted).toEqual([])
  })
})
