import {
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createPackagesDemoClient } from './packagesClient'

function capture() {
  const seen: Array<Record<string, unknown>> = []
  const adapter: AxiosAdapter = async (
    config: InternalAxiosRequestConfig,
  ): Promise<AxiosResponse> => {
    seen.push({ ...config.headers })
    return {
      config,
      data: { value: {}, meta: { timestamp: 't' } },
      headers: {},
      status: 200,
      statusText: 'OK',
    }
  }
  return { seen, adapter }
}

describe('createPackagesDemoClient — the demo page signs requests with a dev-login identity', () => {
  it('sends the identity typed on the page: acc_ → account id, an email → email, anything else → username', async () => {
    const { seen, adapter } = capture()
    let identity = 'acc_demo'
    const client = createPackagesDemoClient({ getIdentity: () => identity, env: {}, adapter })
    await client.value('/x')
    identity = 'demo@example.com'
    await client.value('/x')
    identity = 'alice'
    await client.value('/x')
    expect(seen[0]['X-Dev-Account-Id']).toBe('acc_demo')
    expect(seen[1]['X-Dev-Email']).toBe('demo@example.com')
    expect(seen[2]['X-Dev-Username']).toBe('alice')
  })

  it('a blank identity sends no dev-login header at all', async () => {
    const { seen, adapter } = capture()
    const client = createPackagesDemoClient({ getIdentity: () => '  ', env: {}, adapter })
    await client.value('/x')
    expect(Object.keys(seen[0]).filter((name) => name.startsWith('X-Dev-'))).toEqual([])
  })
})
