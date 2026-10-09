import type { ApiClient } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createCheerApi } from './cheerApi'

type Call = { path: string; request?: Record<string, unknown> }

/** 요청만 기록하는 가짜 클라이언트 — 경로 · 쿼리가 백엔드 계약(`/api/v1/cheers/*`)과 같은지 본다 */
function fakeClient() {
  const calls: Call[] = []
  const record = (reply: unknown) => async (path: string, request?: Record<string, unknown>) => {
    calls.push({ path, request })
    return reply
  }
  const client = {
    list: record([{ itemRef: 'cheer-1000', amount: { amount: 1000, currency: 'KRW' } }]),
    cursor: record({ values: [], cursor: { hasNext: false, nextCursor: null }, meta: {} }),
  } as unknown as Pick<ApiClient, 'list' | 'cursor'>
  return { client, calls }
}

describe('createCheerApi', () => {
  it('reads the amounts the server offers from GET /cheers/options (the browser never picks an amount)', async () => {
    const { client, calls } = fakeClient()
    const options = await createCheerApi(client).options()
    expect(calls).toEqual([{ path: '/cheers/options', request: undefined }])
    expect(options).toEqual([{ itemRef: 'cheer-1000', amount: { amount: 1000, currency: 'KRW' } }])
  })

  it('reads my cheers newest first from GET /cheers/me, sending only the cursor and size that are set', async () => {
    const { client, calls } = fakeClient()
    await createCheerApi(client).mine()
    await createCheerApi(client).mine({ cursor: 'c1', size: 20 })
    expect(calls[0]).toEqual({ path: '/cheers/me', request: { params: {} } })
    expect(calls[1]).toEqual({
      path: '/cheers/me',
      request: { params: { cursor: 'c1', size: 20 } },
    })
  })

  it('the base path can move (a backend that opens the cheers elsewhere)', async () => {
    const { client, calls } = fakeClient()
    await createCheerApi(client, { basePath: '/support/' }).options()
    expect(calls[0].path).toBe('/support/options')
  })
})
