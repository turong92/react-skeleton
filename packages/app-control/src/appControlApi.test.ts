import { describe, expect, it, vi } from 'vitest'
import { createAppControlApi } from './appControlApi'
import type { AppConfig } from './types'

const config: AppConfig = {
  serverTime: '2026-11-16T09:00:00Z',
  maintenance: { enabled: false, message: null, endsAt: null },
  flags: { beta: true },
  platforms: {},
}

type Client = Parameters<typeof createAppControlApi>[0]

describe('createAppControlApi', () => {
  it('reads the config from /app/config by default and from basePath when the backend moved it', async () => {
    const value = vi.fn(async () => config)
    const client = { value } as unknown as Client

    expect(await createAppControlApi(client).config()).toEqual(config)
    expect(value).toHaveBeenCalledWith('/app/config')

    await createAppControlApi(client, { basePath: '/ops/config' }).config()
    expect(value).toHaveBeenLastCalledWith('/ops/config')
  })
})
