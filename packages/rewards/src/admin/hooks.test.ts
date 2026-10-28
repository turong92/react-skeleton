import { describe, expect, it } from 'vitest'
import { adminCouponDefinitionsQuery } from './hooks'

describe('admin list queries', () => {
  const api = { listCouponDefinitions: async () => [] }
  it('the coupon definitions are not read unless asked (a campaign-only operator would get a 403 toast)', () => {
    expect(adminCouponDefinitionsQuery(api, false).enabled).toBe(false)
    expect(adminCouponDefinitionsQuery(api).enabled).toBe(true)
  })
  it('a 404 (the module has its admin tool off) is quiet - the screen says so itself - and is not retried', () => {
    const query = adminCouponDefinitionsQuery(api)
    expect(query.meta.quietStatuses).toContain(404)
    expect(query.retry).toBe(false)
  })
})
