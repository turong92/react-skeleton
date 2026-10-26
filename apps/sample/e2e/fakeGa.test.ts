import { createSign } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { answerReport, FAKE_GA, gaControl, startFakeGa, type FakeGa } from './fakeGa'

let fake: FakeGa
beforeAll(async () => {
  fake = await startFakeGa()
})
afterAll(async () => {
  await fake.close()
})

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${fake.url}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })

describe('the fake GA (contract C4)', () => {
  it('gives a service account whose key signs RS256, and the token endpoint records only the iss of the JWT it gets', async () => {
    const account = JSON.parse(fake.serviceAccountJson) as {
      private_key: string
      client_email: string
      token_uri: string
    }
    const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
    const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: account.client_email, aud: account.token_uri })}`
    const jwt = `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(account.private_key, 'base64url')}`
    const control = gaControl(fake.url)
    await control.reset()
    const response = await fetch(account.token_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    })
    expect(await response.json()).toMatchObject({ access_token: FAKE_GA.accessToken })
    expect((await control.state()).tokenRequests).toEqual([{ iss: FAKE_GA.clientEmail }])
  })

  it('answers a report by the dimension and metric names asked, and refuses a wrong token with 401', async () => {
    const path = `/v1beta/properties/${FAKE_GA.propertyId}:runReport`
    expect((await post(path, {}, { Authorization: 'Bearer nope' })).status).toBe(401)
    const ok = await post(
      path,
      {
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }, { name: `keyEvents:${FAKE_GA.keyEvent}` }],
      },
      { Authorization: `Bearer ${FAKE_GA.accessToken}` },
    )
    const body = (await ok.json()) as {
      rows: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[]
    }
    expect(body.rows[0]).toEqual({
      dimensionValues: [{ value: 'Organic Search' }],
      metricValues: [{ value: '410' }, { value: '12' }],
    })
  })

  it('realtime pages and countries each add up to the active users the header shows', () => {
    const sum = (rows: { metricValues: { value: string }[] }[]) =>
      rows.reduce((n, r) => n + Number(r.metricValues[0].value), 0)
    expect(sum(answerReport(true, ['unifiedScreenName'], ['activeUsers']).rows)).toBe(
      FAKE_GA.realtimeUsers,
    )
    expect(sum(answerReport(true, ['country'], ['activeUsers']).rows)).toBe(FAKE_GA.realtimeUsers)
  })
})
