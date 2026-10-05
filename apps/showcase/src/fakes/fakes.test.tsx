import { ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { AuthProvider, RequireAuth, createAuthSession, createTokenStore } from '@skeleton/auth'
import { createInboxSync, unreadCountQuery } from '@skeleton/notifications'
import { UploadAbortedError, createUploader } from '@skeleton/storage'
import { QueryClient } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createFakeAuthApi, DEMO_LOGIN } from './fakeAuthApi'
import { createFakeInbox } from './fakeInbox'
import { createFakeStorage } from './fakeStorage'
import { createFakeTurnstile } from './fakeTurnstile'
import { runApiErrorCases } from './apiErrorCases'

describe('fake auth', () => {
  const session = () => createAuthSession({ api: createFakeAuthApi(), store: createTokenStore() })
  const gated = (s: ReturnType<typeof session>) =>
    renderToStaticMarkup(
      <AuthProvider session={s}>
        <MemoryRouter initialEntries={['/secret']}>
          <Routes>
            <Route element={<RequireAuth redirectTo="/login" />}>
              <Route path="/secret" element={<p>secret page</p>} />
            </Route>
            <Route path="/login" element={<p>login page</p>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

  it('rejects a wrong password with AUTH.INVALID_CREDENTIALS', async () => {
    const error = await session()
      .login({ email: DEMO_LOGIN.email, password: 'nope' })
      .catch((caught: unknown) => caught)
    expect(isErrorCode(error, ErrorCodes.AUTH_INVALID_CREDENTIALS)).toBe(true)
  })

  it('RequireAuth hides the secret until the fake login succeeds', async () => {
    const s = session()
    expect(gated(s)).not.toContain('secret page')
    await s.login(DEMO_LOGIN)
    expect(gated(s)).toContain('secret page')
  })
})

describe('fake inbox + fake realtime event', () => {
  it('a pushed event bumps the unread count and shows up in the list', async () => {
    const inbox = createFakeInbox()
    const client = new QueryClient()
    expect(await client.fetchQuery(unreadCountQuery(inbox.api))).toBe(2)
    const sync = createInboxSync(client)
    expect(sync.ingest(inbox.publish('새 알림'))).toBe(true)
    expect(client.getQueryData(unreadCountQuery(inbox.api).queryKey)).toBe(3)
    const page = await inbox.api.list({ page: 0, size: 10 })
    expect(page.values[0].title).toBe('새 알림')
    expect(page.pagination.totalElements).toBe(4)
  })

  it('markRead and markAllRead change the unread total', async () => {
    const inbox = createFakeInbox()
    const first = (await inbox.api.list({ unreadOnly: true })).values[0]
    await inbox.api.markRead(first.eventId)
    expect((await inbox.api.list({ unreadOnly: true, size: 1 })).pagination.totalElements).toBe(1)
    expect(await inbox.api.markAllRead()).toEqual({ updated: 1 })
  })
})

describe('fake storage', () => {
  const file = new File(['x'.repeat(1000)], 'photo.txt', { type: 'text/plain' })

  it('reports progress that reaches 1 and returns the key', async () => {
    const fake = createFakeStorage({ steps: 4, stepMs: 0 })
    const fractions: number[] = []
    const result = await createUploader({ api: fake.api, transport: fake.transport }).upload(file, {
      onProgress: (progress) => fractions.push(progress.fraction),
    })
    expect(fractions.at(-1)).toBe(1)
    expect(fractions.length).toBeGreaterThanOrEqual(4)
    expect(result.key).toContain('photo.txt')
  })

  it('aborts when the signal fires', async () => {
    const fake = createFakeStorage({ steps: 50, stepMs: 5 })
    const controller = new AbortController()
    const pending = createUploader({ api: fake.api, transport: fake.transport }).upload(file, {
      signal: controller.signal,
    })
    setTimeout(() => controller.abort(), 10)
    await expect(pending).rejects.toBeInstanceOf(UploadAbortedError)
  })
})

describe('fake turnstile', () => {
  it('solve() hands the widget callback a token', async () => {
    const fake = createFakeTurnstile()
    const tokens: string[] = []
    const api = await fake.loader()
    api.render({} as HTMLElement, { sitekey: 'k', callback: (token) => tokens.push(token) })
    fake.solve()
    expect(tokens).toEqual([fake.token])
  })
})

describe('api-client error cases', () => {
  it('runs real requests over a fake adapter and reports isErrorCode per case', async () => {
    const cases = await runApiErrorCases()
    expect(cases.map((c) => [c.status, c.code, c.isInvalidCredentials])).toEqual([
      [401, 'AUTH.INVALID_CREDENTIALS', true],
      [404, 'COMMON.NOT_FOUND', false],
      [0, 'CLIENT.NETWORK_ERROR', false],
    ])
  })
})
