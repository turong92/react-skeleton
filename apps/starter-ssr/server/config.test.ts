import { describe, expect, it } from 'vitest'
import { readServerConfig } from './config.ts'

describe('readServerConfig — the env the Node server reads', () => {
  it('has safe defaults: loopback host, port 3000, local backend, a short server-side timeout', () => {
    const config = readServerConfig({})
    expect(config).toMatchObject({
      host: '127.0.0.1',
      port: 3000,
      apiBaseUrl: 'http://localhost:8080/api/v1',
      apiTimeoutMs: 2000,
    })
    expect(config.distDir.endsWith('/dist')).toBe(true)
  })

  it('reads HOST · PORT · API_BASE_URL · SSR_API_TIMEOUT_MS · DIST_DIR, trimming trailing slashes off the base url', () => {
    const config = readServerConfig({
      HOST: '0.0.0.0',
      PORT: '8081',
      API_BASE_URL: 'http://backend:8080/api/v1///',
      SSR_API_TIMEOUT_MS: '750',
      DIST_DIR: '/srv/app/dist',
    })
    expect(config).toEqual({
      host: '0.0.0.0',
      port: 8081,
      apiBaseUrl: 'http://backend:8080/api/v1',
      apiTimeoutMs: 750,
      distDir: '/srv/app/dist',
    })
  })

  it('PORT=0 means "pick a free port" (the integration test uses it)', () => {
    expect(readServerConfig({ PORT: '0' }).port).toBe(0)
  })

  it('refuses values it cannot use instead of guessing', () => {
    expect(() => readServerConfig({ PORT: 'abc' })).toThrow(/PORT/)
    expect(() => readServerConfig({ PORT: '70000' })).toThrow(/PORT/)
    expect(() => readServerConfig({ SSR_API_TIMEOUT_MS: '0' })).toThrow(/SSR_API_TIMEOUT_MS/)
    expect(() => readServerConfig({ API_BASE_URL: '/api/v1' })).toThrow(/API_BASE_URL/)
  })
})
