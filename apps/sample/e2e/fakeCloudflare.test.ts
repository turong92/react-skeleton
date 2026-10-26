import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  cloudflareControl,
  FAKE_CLOUDFLARE,
  parseAliases,
  startFakeCloudflare,
  type FakeCloudflare,
} from './fakeCloudflare'

const QUERY = `query {
  viewer { accounts(filter: { accountTag: "e2e-cf-account" }) {
    total: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { siteTag: "e2e-cf-site-tag", datetime_geq: "2026-10-26T00:00:00Z", datetime_lt: "2026-10-27T00:00:00Z" }) { count sum { visits } avg { sampleInterval } }
    refs: rumPageloadEventsAdaptiveGroups(limit: 50, filter: { siteTag: "e2e-cf-site-tag" }) { count sum { visits } avg { sampleInterval } dimensions { refererHost } }
  } }
}`

let fake: FakeCloudflare
beforeAll(async () => {
  fake = await startFakeCloudflare()
})
afterAll(async () => {
  await fake.close()
})

describe('the fake Cloudflare (contract C4)', () => {
  it('reads each alias and the dimensions it asks for', () => {
    expect(parseAliases(QUERY)).toEqual([
      { alias: 'total', dimensions: [] },
      { alias: 'refs', dimensions: ['refererHost'] },
    ])
  })

  it('refuses a wrong token with 403, answers every alias in one response, and records the site tag it was asked for', async () => {
    const control = cloudflareControl(fake.url)
    await control.reset()
    const denied = await fetch(`${fake.url}/client/v4/graphql`, {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong' },
      body: JSON.stringify({ query: QUERY }),
    })
    expect(denied.status).toBe(403)
    const ok = await fetch(`${fake.url}/client/v4/graphql`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${FAKE_CLOUDFLARE.apiToken}` },
      body: JSON.stringify({ query: QUERY }),
    })
    const body = (await ok.json()) as {
      data: { viewer: { accounts: Record<string, unknown[]>[] } }
    }
    const [account] = body.data.viewer.accounts
    expect(account.total).toEqual([
      {
        count: FAKE_CLOUDFLARE.pageviewsSampled,
        sum: { visits: FAKE_CLOUDFLARE.visitsSampled },
        avg: { sampleInterval: 2 },
        dimensions: {},
      },
    ])
    expect((account.refs[0] as { dimensions: unknown }).dimensions).toEqual({
      refererHost: 'fake-referrer.example',
    })
    expect((await control.requests()).map((r) => [r.authorized, r.siteTag])).toEqual([
      [false, 'e2e-cf-site-tag'],
      [true, 'e2e-cf-site-tag'],
    ])
    // 환산 뒤 값이 화면 값(상수)과 맞다
    expect(FAKE_CLOUDFLARE.visitsSampled * FAKE_CLOUDFLARE.sampleInterval).toBe(
      FAKE_CLOUDFLARE.visitsShown,
    )
    expect(FAKE_CLOUDFLARE.pageviewsSampled * FAKE_CLOUDFLARE.sampleInterval).toBe(
      FAKE_CLOUDFLARE.pageviewsShown,
    )
  })
})
