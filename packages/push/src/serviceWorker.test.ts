import { describe, expect, it } from 'vitest'
import { pushWorkerSource } from './serviceWorker'

type Listener = (event: unknown) => void

/** 워커 소스를 가짜 `self` 로 실제 실행한다 — 이벤트를 보내고 한 일을 기록한다 */
function runWorker(windows: Array<{ url: string }> = []) {
  const listeners = new Map<string, Listener>()
  const shown: Array<{ title: string; options: Record<string, unknown> }> = []
  const opened: string[] = []
  const navigated: string[] = []
  let focused = 0
  const self = {
    location: { origin: 'https://app.example.com' },
    addEventListener: (type: string, listener: Listener) => void listeners.set(type, listener),
    registration: {
      showNotification: async (title: string, options: Record<string, unknown>) => {
        shown.push({ title, options })
      },
    },
    clients: {
      matchAll: async () =>
        windows.map((w) => ({
          url: w.url,
          focus: async () => void focused++,
          navigate: async (url: string) => void navigated.push(url),
        })),
      openWindow: async (url: string) => void opened.push(url),
    },
  }
  new Function('self', pushWorkerSource({ icon: '/icon.png' }))(self)

  const settle = async (event: { waited?: Promise<unknown> }) => {
    await event.waited
  }
  return {
    shown,
    opened,
    navigated,
    focused: () => focused,
    async push(payload: unknown) {
      const event = {
        data: { json: () => payload },
        waited: undefined as Promise<unknown> | undefined,
        waitUntil(p: Promise<unknown>) {
          event.waited = p
        },
      }
      listeners.get('push')!(event)
      await settle(event)
    },
    async click(link: unknown) {
      const event = {
        notification: { data: { link }, close: () => undefined },
        waited: undefined as Promise<unknown> | undefined,
        waitUntil(p: Promise<unknown>) {
          event.waited = p
        },
      }
      listeners.get('notificationclick')!(event)
      await settle(event)
    },
    listeners,
  }
}

describe('the push service worker (executed from its source)', () => {
  it('always shows a notification for a push, using the v1 payload', async () => {
    const worker = runWorker()
    await worker.push({ v: 1, title: 'New comment', body: 'Ada: hi', tag: 'c1', link: '/notes/1' })
    expect(worker.shown).toEqual([
      {
        title: 'New comment',
        options: { body: 'Ada: hi', tag: 'c1', icon: '/icon.png', data: { link: '/notes/1' } },
      },
    ])
  })

  it('shows something even for a payload it cannot read (Chrome punishes a push that shows nothing)', async () => {
    const worker = runWorker()
    await worker.push(null)
    expect(worker.shown).toHaveLength(1)
    expect(worker.shown[0].title).not.toBe('')
  })

  it('does not subscribe to pushsubscriptionchange (it has no sign-in to tell the server)', () => {
    expect(runWorker().listeners.has('pushsubscriptionchange')).toBe(false)
  })

  it.each([
    { link: '//evil.example', why: 'protocol-relative' },
    { link: '/\\evil.example', why: 'backslash' },
    { link: '/\t/evil.example', why: 'a tab the URL parser strips, leaving //' },
    { link: 'https://evil.example/x', why: 'absolute https' },
    { link: 'javascript:alert(1)', why: 'javascript' },
    { link: 'notes/1', why: 'relative without a slash' },
    { link: 42, why: 'not a string' },
  ])('refuses a link that is $why — a click opens the app root instead', async ({ link }) => {
    const worker = runWorker()
    await worker.click(link)
    expect(worker.opened).toEqual(['https://app.example.com/'])
    expect(worker.navigated).toEqual([])
  })

  it('a click on an app path opens it in a new window when none is open', async () => {
    const worker = runWorker()
    await worker.click('/notes/1?tab=comments#c1')
    expect(worker.opened).toEqual(['https://app.example.com/notes/1?tab=comments#c1'])
  })

  it('a click brings the open same-origin window forward and moves it there', async () => {
    const worker = runWorker([
      { url: 'https://other.example/' },
      { url: 'https://app.example.com/home' },
    ])
    await worker.click('/notes/1')
    expect(worker.focused()).toBe(1)
    expect(worker.navigated).toEqual(['https://app.example.com/notes/1'])
    expect(worker.opened).toEqual([])
  })
})
