import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

/*
 * 가짜 Cloudflare — 진짜 계정 없이 대시보드의 Cloudflare 카드(방문 · 유입 · 페이지 · 국가 · 기기)를 끝까지 돌려 본다. 모양은 계획 계약 C4 한 곳을 따른다
 * (추측이다 — 형이 토큰을 주면 실제 질의로 재서 이 파일 · kotlin 의 `FakeCloudflareApi` · 스펙 §3.2 를 같이 고친다):
 *   POST /client/v4/graphql  (Bearer 토큰이 틀리면 403) — 질의 하나에 별칭 여러 개(`<별칭>: rumPageloadEventsAdaptiveGroups(...) { count sum { visits } avg { sampleInterval } dimensions { … } }`)
 *   응답 `{ data: { viewer: { accounts: [ { <별칭>: [ { count, sum: { visits }, avg: { sampleInterval }, dimensions } ] } ] } }, errors: null }`.
 *   별칭마다 `dimensions { … }` 의 필드 이름을 읽어 답한다: 없음 = 합계 한 줄 · `date` · `datetimeHour` = 시계열 · `refererHost` · `requestPath` · `countryName` · `deviceType` = 순위.
 * 값은 표본 환산(`× avg.sampleInterval`)을 거치게 일부러 sampleInterval 2 로 준다 — 화면에 나오는 값은 `FAKE_CLOUDFLARE` 의 `*Shown`(환산 뒤)이다.
 *
 * 제어: `GET /control` → { requests: [{ authorized, siteTag, aliases, dimensions }] } · `POST /control { reset: true }`.
 */

export const FAKE_CLOUDFLARE = {
  accountId: 'e2e-cf-account',
  siteTag: 'e2e-cf-site-tag',
  apiToken: 'e2e-cf-api-token-0123456789',
  /** 표본 간격 — 받은 값에 이 수를 곱해야 실제 수다 */
  sampleInterval: 2,
  /** 질의가 주는 표본 수(환산 전) */
  visitsSampled: 500,
  pageviewsSampled: 1500,
  /** 화면에 나오는 값(환산 뒤) */
  visitsShown: 1000,
  pageviewsShown: 3000,
  referers: [
    { host: 'fake-referrer.example', visits: 300 },
    { host: 'other-referrer.example', visits: 120 },
  ],
  paths: [
    { path: '/', views: 700 },
    { path: '/pricing', views: 250 },
  ],
  countries: [
    { name: 'South Korea', visits: 400 },
    { name: 'Japan', visits: 100 },
  ],
  devices: [
    { name: 'mobile', visits: 350 },
    { name: 'desktop', visits: 150 },
  ],
}

export type FakeCloudflareRequest = {
  authorized: boolean
  siteTag: string | null
  aliases: string[]
  dimensions: string[][]
}
export type FakeCloudflare = { url: string; close(): Promise<void> }

/** 질의 글에서 별칭마다 `dimensions { … }` 의 필드 이름을 읽는다(중괄호 짝으로 별칭 블록을 자른다) */
export function parseAliases(query: string): { alias: string; dimensions: string[] }[] {
  const found: { alias: string; dimensions: string[] }[] = []
  const head = /(\w+)\s*:\s*rumPageloadEventsAdaptiveGroups\b/g
  for (let match = head.exec(query); match; match = head.exec(query)) {
    const open = query.indexOf('{', query.indexOf(')', match.index))
    if (open < 0) continue
    let depth = 0
    let end = open
    for (; end < query.length; end++) {
      if (query[end] === '{') depth++
      else if (query[end] === '}' && --depth === 0) break
    }
    const block = query.slice(open, end)
    const dims = /dimensions\s*\{([^}]*)\}/.exec(block)?.[1] ?? ''
    found.push({ alias: match[1], dimensions: dims.split(/[\s,]+/).filter(Boolean) })
  }
  return found
}

function rowsFor(dimensions: string[], range: { from: string; to: string }) {
  const sample = FAKE_CLOUDFLARE.sampleInterval
  const row = (count: number, visits: number, dims: Record<string, string> = {}) => ({
    count,
    sum: { visits },
    avg: { sampleInterval: sample },
    dimensions: dims,
  })
  const [first] = dimensions
  switch (first) {
    case undefined:
      return [row(FAKE_CLOUDFLARE.pageviewsSampled, FAKE_CLOUDFLARE.visitsSampled)]
    case 'date':
    case 'datetimeHour': {
      const dates = datesBetween(range.from, range.to)
      return dates.map((day) =>
        row(
          Math.round(FAKE_CLOUDFLARE.pageviewsSampled / dates.length),
          Math.round(FAKE_CLOUDFLARE.visitsSampled / dates.length),
          {
            [first]: first === 'date' ? day : `${day}T00:00:00Z`,
          },
        ),
      )
    }
    case 'refererHost':
      return FAKE_CLOUDFLARE.referers.map((r) => row(r.visits, r.visits, { refererHost: r.host }))
    case 'requestPath':
      return FAKE_CLOUDFLARE.paths.map((p) => row(p.views, p.views, { requestPath: p.path }))
    case 'countryName':
      return FAKE_CLOUDFLARE.countries.map((c) => row(c.visits, c.visits, { countryName: c.name }))
    case 'deviceType':
      return FAKE_CLOUDFLARE.devices.map((d) => row(d.visits, d.visits, { deviceType: d.name }))
    default:
      return []
  }
}

function datesBetween(from: string, to: string): string[] {
  const out: string[] = []
  const end = Date.parse(`${to.slice(0, 10)}T00:00:00Z`)
  for (
    let t = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
    t <= end && out.length < 400;
    t += 86_400_000
  ) {
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out.length > 0 ? out : [from.slice(0, 10)]
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

export async function startFakeCloudflare(): Promise<FakeCloudflare> {
  let requests: FakeCloudflareRequest[] = []
  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname === '/control') {
      if (req.method === 'POST') {
        const body = JSON.parse((await readBody(req)) || '{}') as { reset?: boolean }
        if (body.reset) requests = []
        return json(res, 200, { ok: true })
      }
      return json(res, 200, { requests })
    }
    if (req.method === 'POST' && url.pathname === '/client/v4/graphql') {
      const authorized = req.headers.authorization === `Bearer ${FAKE_CLOUDFLARE.apiToken}`
      const body = JSON.parse((await readBody(req)) || '{}') as {
        query?: string
        variables?: Record<string, unknown>
      }
      const query = body.query ?? ''
      const aliases = parseAliases(query)
      const siteTag =
        /siteTag(?:_in)?\s*:\s*\[?\s*"([^"]+)"/.exec(query)?.[1] ??
        (typeof body.variables?.siteTag === 'string' ? body.variables.siteTag : null)
      requests.push({
        authorized,
        siteTag,
        aliases: aliases.map((a) => a.alias),
        dimensions: aliases.map((a) => a.dimensions),
      })
      if (!authorized) return json(res, 403, { errors: [{ message: 'Authentication error' }] })
      const from =
        /datetime_geq\s*:\s*"([^"]+)"/.exec(query)?.[1] ??
        String(body.variables?.from ?? new Date().toISOString())
      const to =
        /datetime_lt\s*:\s*"([^"]+)"/.exec(query)?.[1] ?? String(body.variables?.to ?? from)
      const account: Record<string, unknown> = {}
      for (const { alias, dimensions } of aliases)
        account[alias] = rowsFor(dimensions, { from, to })
      return json(res, 200, { data: { viewer: { accounts: [account] } }, errors: null })
    }
    return json(res, 404, { errors: [{ message: 'not found' }] })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as { port: number }
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

export function cloudflareControl(url: string) {
  return {
    requests: async (): Promise<FakeCloudflareRequest[]> =>
      ((await (await fetch(`${url}/control`)).json()) as { requests: FakeCloudflareRequest[] })
        .requests,
    reset: async () =>
      void (await fetch(`${url}/control`, {
        method: 'POST',
        body: JSON.stringify({ reset: true }),
      })),
  }
}
