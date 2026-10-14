import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it } from 'vitest'
import { createProjectDispatcher, hostOf, readProjects } from './projects.ts'

/*
 * 서버 하나가 요청 Host 로 프로젝트를 고른다 — 틀리면 한 프로젝트의 화면이 다른 도메인에 나간다.
 * 여기서는 「어느 Host 가 어느 프로젝트로 가는가」와 「모르는 Host 는 거절」을 잰다(진짜 서버 확인은 server.integration.test.ts).
 */
describe('hostOf — the host a request was addressed to (port stripped, lower-case)', () => {
  it('strips the port and lower-cases; handles IPv6 and a missing header', () => {
    expect(hostOf('A.Localhost:3000')).toBe('a.localhost')
    expect(hostOf('example.com')).toBe('example.com')
    expect(hostOf('[::1]:3000')).toBe('[::1]')
    expect(hostOf('example.com.')).toBe('example.com')
    expect(hostOf(undefined)).toBeUndefined()
    expect(hostOf('')).toBeUndefined()
  })
})

describe('readProjects — the projects file', () => {
  const file = (projects: Record<string, unknown>) => ({ projects })

  it('reads hosts (lower-cased), a dist folder relative to the file, and optional backend / site address', () => {
    const projects = readProjects(
      file({
        a: {
          hosts: ['A.localhost', 'a.example.com'],
          distDir: 'dist/a',
          apiBaseUrl: 'http://x/api/v1/',
        },
      }),
      '/srv/app',
    )
    expect(projects).toEqual([
      {
        name: 'a',
        hosts: ['a.localhost', 'a.example.com'],
        distDir: '/srv/app/dist/a',
        apiBaseUrl: 'http://x/api/v1',
        siteUrl: undefined,
      },
    ])
  })

  it('refuses the same host in two projects — a request could not pick one', () => {
    expect(() =>
      readProjects(
        file({
          a: { hosts: ['x.localhost'], distDir: 'dist/a', apiBaseUrl: 'http://x/api/v1' },
          b: { hosts: ['X.localhost'], distDir: 'dist/b', apiBaseUrl: 'http://x/api/v1' },
        }),
        '/srv',
      ),
    ).toThrow(/x\.localhost.*a.*b/s)
  })

  it('requires the backend address per project — no fallback to a shared one that could send another project’s data', () => {
    expect(() => readProjects(file({ a: { hosts: ['a.localhost'], distDir: 'd' } }), '/')).toThrow(
      /apiBaseUrl/,
    )
  })

  it('refuses a project with no hosts, a host with a port, an odd project name, or an empty list', () => {
    expect(() =>
      readProjects(file({ a: { hosts: [], distDir: 'd', apiBaseUrl: 'http://x/api/v1' } }), '/'),
    ).toThrow(/hosts/)
    expect(() =>
      readProjects(
        file({ a: { hosts: ['a.localhost:3000'], distDir: 'd', apiBaseUrl: 'http://x/api/v1' } }),
        '/',
      ),
    ).toThrow(/port/)
    expect(() =>
      readProjects(
        file({ 'A b': { hosts: ['a.localhost'], distDir: 'd', apiBaseUrl: 'http://x/api/v1' } }),
        '/',
      ),
    ).toThrow(/name/)
    expect(() => readProjects(file({}), '/')).toThrow(/at least one project/)
  })
})

function fakeResponse() {
  const sent: { status?: number; headers?: Record<string, unknown>; body?: string } = {}
  const headers: Record<string, unknown> = {}
  const res = {
    setHeader: (name: string, value: unknown) => void (headers[name.toLowerCase()] = value),
    writeHead: (status: number, extra: Record<string, unknown> = {}) => {
      sent.status = status
      sent.headers = { ...headers, ...extra }
    },
    end: (body?: string) => void (sent.body = body),
  } as unknown as ServerResponse
  return { res, sent }
}
const requestTo = (host: string | undefined) =>
  ({ headers: { host } }) as unknown as IncomingMessage

describe('createProjectDispatcher — one handler per project, chosen by Host', () => {
  const projects = readProjects(
    {
      projects: {
        a: {
          hosts: ['a.localhost', 'a.example.com'],
          distDir: 'dist/a',
          apiBaseUrl: 'http://x/api/v1',
        },
        b: { hosts: ['b.localhost'], distDir: 'dist/b', apiBaseUrl: 'http://x/api/v1' },
      },
    },
    '/srv',
  )
  const calls: string[] = []
  const dispatch = createProjectDispatcher(projects, (project) => async (_req, res) => {
    calls.push(project.name)
    res.writeHead(200)
    res.end(project.name)
  })

  it('sends each host to its own project, whatever the port or case', async () => {
    calls.length = 0
    for (const host of ['a.localhost:3000', 'A.EXAMPLE.COM', 'b.localhost']) {
      const { res } = fakeResponse()
      await dispatch(requestTo(host), res)
    }
    expect(calls).toEqual(['a', 'a', 'b'])
  })

  it('answers /healthz for any host (platform health checks hit localhost) without picking a project', async () => {
    calls.length = 0
    for (const host of ['localhost:3000', 'evil.example.com', undefined]) {
      const { res, sent } = fakeResponse()
      await dispatch({ ...requestTo(host), url: '/healthz', method: 'GET' } as IncomingMessage, res)
      expect(sent.status, String(host)).toBe(200)
    }
    expect(calls).toEqual([])
  })

  it('rejects a host that is not in the list (421) without calling any project; the answer varies by Host', async () => {
    calls.length = 0
    for (const host of ['evil.example.com', 'localhost:3000', undefined]) {
      const { res, sent } = fakeResponse()
      await dispatch(requestTo(host), res)
      expect(sent.status, String(host)).toBe(421)
    }
    expect(calls).toEqual([])
    const { res, sent } = fakeResponse()
    await dispatch(requestTo('a.localhost'), res)
    expect(sent.headers?.vary).toBe('Host')
  })
})
