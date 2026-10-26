import { generateKeyPairSync } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

/*
 * 가짜 GA4 — 진짜 속성 없이 대시보드의 GA 카드(채널 · 전환 · 캠페인 · 첫 페이지 · 페이지 이동 · 재방문)와 「지금 N명」을 끝까지 돌려 본다. 모양은 계획 계약 C4 한 곳(추측 - 형이 키를 주면 맞춘다):
 *   토큰   POST /token  (JWT bearer grant: `assertion` 폼 값) — 가짜는 JWT 의 `iss`(서비스 계정 이메일)만 본다 → { access_token, expires_in }
 *   보고서 POST /v1beta/properties/{id}:runReport · :runRealtimeReport  (Authorization: Bearer 가짜 토큰이 아니면 401)
 *          요청 { dateRanges, dimensions: [{ name }], metrics: [{ name }], limit, orderBys } → 응답 { dimensionHeaders, metricHeaders, rows: [{ dimensionValues: [{ value }], metricValues: [{ value }] }], rowCount }
 *   차원 `date` · `sessionDefaultChannelGroup` · `sessionCampaignName` · `landingPage` · `pageReferrer` · `pagePath` · `newVsReturning`, 지표 `sessions` · `activeUsers` · `keyEvents:<이벤트>`,
 *   실시간 차원 `unifiedScreenName` · `country`, 지표 `activeUsers` — 합이 `FAKE_GA.realtimeUsers`(7).
 * 서비스 계정 키는 시험용 RSA 키를 새로 만들어 JSON 으로 준다(`serviceAccountJson`) — 백엔드는 이것으로 RS256 서명을 하고, 가짜는 서명을 검증하지 않는다.
 *
 * 제어: `GET /control` → { tokenRequests: [{ iss }], reports: [{ realtime, authorized, dimensions, metrics }] } · `POST /control { reset: true }`.
 */

export const FAKE_GA = {
  propertyId: '123456789',
  keyEvent: 'purchase',
  clientEmail: 'e2e-reader@fake-project.iam.gserviceaccount.com',
  accessToken: 'e2e-ga-access-token',
  realtimeUsers: 7,
  channels: [
    { name: 'Organic Search', sessions: 410, conversions: 12 },
    { name: 'Direct', sessions: 290, conversions: 6 },
  ],
  campaigns: [{ name: 'fake_campaign / social', sessions: 55, conversions: 3 }],
  landingPages: [{ page: '/fake-landing', sessions: 300 }],
  transitions: [{ from: '/', to: '/fake-next', count: 90 }],
  returning: [
    { kind: 'returning', users: 120 },
    { kind: 'new', users: 380 },
  ],
  realtimePages: [
    { page: '/', users: 4 },
    { page: '/pricing', users: 3 },
  ],
  realtimeCountries: [
    { country: 'South Korea', users: 5 },
    { country: 'Japan', users: 2 },
  ],
}

type Report = { realtime: boolean; authorized: boolean; dimensions: string[]; metrics: string[] }
export type FakeGa = {
  url: string
  /** 백엔드 설정의 `dashboard-ga.credentials` 에 들어가는 서비스 계정 JSON(`token_uri` 가 이 서버) */
  serviceAccountJson: string
  close(): Promise<void>
}

const readBody = (req: IncomingMessage) =>
  new Promise<string>((resolve) => {
    let text = ''
    req.on('data', (chunk) => (text += chunk))
    req.on('end', () => resolve(text))
  })
const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

type Cell = string | number
const table = (dims: string[], metrics: string[], lines: Cell[][]) => ({
  dimensionHeaders: dims.map((name) => ({ name })),
  metricHeaders: metrics.map((name) => ({ name, type: 'TYPE_INTEGER' })),
  rows: lines.map((line) => ({
    dimensionValues: line.slice(0, dims.length).map((value) => ({ value: String(value) })),
    metricValues: line.slice(dims.length).map((value) => ({ value: String(value) })),
  })),
  rowCount: lines.length,
})

/** 요청한 지표 이름마다 그 줄의 값을 고른다 - `keyEvents:<이벤트>` 는 전환 수 */
function metricsOf(
  metrics: string[],
  values: { sessions?: number; users?: number; conversions?: number },
): Cell[] {
  return metrics.map((name) =>
    name === 'sessions' || name === 'screenPageViews'
      ? (values.sessions ?? 0)
      : name === 'activeUsers'
        ? (values.users ?? values.sessions ?? 0)
        : name.startsWith('keyEvents')
          ? (values.conversions ?? 0)
          : 0,
  )
}

export function answerReport(realtime: boolean, dims: string[], metrics: string[]) {
  const [first] = dims
  const lines = (
    rows: { label: string; sessions?: number; users?: number; conversions?: number }[],
  ) => rows.map((r) => [r.label, ...metricsOf(metrics, r)])
  if (realtime) {
    if (first === 'unifiedScreenName')
      return table(
        dims,
        metrics,
        lines(FAKE_GA.realtimePages.map((p) => ({ label: p.page, users: p.users }))),
      )
    if (first === 'country')
      return table(
        dims,
        metrics,
        lines(FAKE_GA.realtimeCountries.map((c) => ({ label: c.country, users: c.users }))),
      )
    return table([], metrics, [[...metricsOf(metrics, { users: FAKE_GA.realtimeUsers })]])
  }
  switch (first) {
    case 'sessionDefaultChannelGroup':
      return table(dims, metrics, lines(FAKE_GA.channels.map((c) => ({ label: c.name, ...c }))))
    case 'sessionCampaignName':
      return table(dims, metrics, lines(FAKE_GA.campaigns.map((c) => ({ label: c.name, ...c }))))
    case 'landingPage':
      return table(
        dims,
        metrics,
        lines(FAKE_GA.landingPages.map((l) => ({ label: l.page, sessions: l.sessions }))),
      )
    case 'pageReferrer':
      return table(
        dims,
        metrics,
        FAKE_GA.transitions.map((t) =>
          [t.from, t.to, ...metricsOf(metrics, { sessions: t.count })].slice(
            0,
            dims.length + metrics.length,
          ),
        ),
      )
    case 'newVsReturning':
      return table(
        dims,
        metrics,
        lines(FAKE_GA.returning.map((r) => ({ label: r.kind, users: r.users }))),
      )
    default:
      return table(dims, metrics, [])
  }
}

export async function startFakeGa(): Promise<FakeGa> {
  let tokenRequests: { iss: string }[] = []
  let reports: Report[] = []
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  let base = ''
  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname === '/control') {
      if (req.method === 'POST') {
        const body = JSON.parse((await readBody(req)) || '{}') as { reset?: boolean }
        if (body.reset) {
          tokenRequests = []
          reports = []
        }
        return json(res, 200, { ok: true })
      }
      return json(res, 200, { tokenRequests, reports })
    }
    if (req.method === 'POST' && url.pathname === '/token') {
      const assertion = new URLSearchParams(await readBody(req)).get('assertion') ?? ''
      const payload = assertion.split('.')[1] ?? ''
      let iss = ''
      try {
        iss =
          (JSON.parse(Buffer.from(payload, 'base64url').toString()) as { iss?: string }).iss ?? ''
      } catch {
        // 형식이 틀린 assertion - iss 없이 기록한다
      }
      tokenRequests.push({ iss })
      return json(res, 200, {
        access_token: FAKE_GA.accessToken,
        expires_in: 3600,
        token_type: 'Bearer',
      })
    }
    const match = /^\/v1beta\/properties\/([^/:]+):(runReport|runRealtimeReport)$/.exec(
      url.pathname,
    )
    if (req.method === 'POST' && match) {
      const body = JSON.parse((await readBody(req)) || '{}') as {
        dimensions?: { name: string }[]
        metrics?: { name: string }[]
      }
      const dims = (body.dimensions ?? []).map((d) => d.name)
      const metrics = (body.metrics ?? []).map((m) => m.name)
      // 속성 id 도 본다 - 다른 id 면 진짜 GA 처럼 403
      if (match[1] !== FAKE_GA.propertyId)
        return json(res, 403, {
          error: { code: 403, message: 'User does not have access to this property.' },
        })
      const authorized = req.headers.authorization === `Bearer ${FAKE_GA.accessToken}`
      reports.push({
        realtime: match[2] === 'runRealtimeReport',
        authorized,
        dimensions: dims,
        metrics,
      })
      if (!authorized)
        return json(res, 401, {
          error: { code: 401, message: 'Request had invalid authentication credentials.' },
        })
      return json(res, 200, answerReport(match[2] === 'runRealtimeReport', dims, metrics))
    }
    return json(res, 404, { error: { code: 404, message: 'not found' } })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as { port: number }
  base = `http://127.0.0.1:${port}`
  return {
    url: base,
    serviceAccountJson: JSON.stringify({
      type: 'service_account',
      project_id: 'fake-project',
      private_key_id: 'e2e',
      private_key: pem,
      client_email: FAKE_GA.clientEmail,
      token_uri: `${base}/token`,
    }),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

export function gaControl(url: string) {
  return {
    state: async () =>
      (await (await fetch(`${url}/control`)).json()) as {
        tokenRequests: { iss: string }[]
        reports: Report[]
      },
    reset: async () =>
      void (await fetch(`${url}/control`, {
        method: 'POST',
        body: JSON.stringify({ reset: true }),
      })),
  }
}
