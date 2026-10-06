import { createHash, createHmac, randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

/*
 * 가짜 LINE · X — 진짜 제공자 없이 소셜 로그인 여정(PKCE · nonce · 주소 없는 계정)을 브라우저로 끝까지 돌려 본다.
 * 백엔드(`feat/social-oidc-x`)의 자기 테스트(`GlobalSocialJourneyIntegrationTest`)가 쓰는 것과 같은 모양의 응답을 낸다(공식 문서 모양):
 *   LINE  /line/authorize(자동 승인 · 취소 흉내) → 코드, /line/token(client_secret_post · code_verifier 검사 · HS256 ID 토큰 — channel secret 으로 서명 · nonce 를 그대로 싣는다), /line/certs(빈 JWKS)
 *   X     /x/authorize(브라우저의 https://x.com/i/oauth2/authorize 를 테스트가 이리로 돌린다), /x/2/oauth2/token(Basic · code_verifier · 30초 수명 없음), /x/2/users/me
 * 일부러 진짜 제공자처럼 엄격하다: 인가 요청에 code_challenge(S256)가 없으면 거절하고, 코드는 한 번만 쓰이고, 검증기가 안 맞으면 invalid_grant.
 * 제어: POST /control {line?: {sub, name, email?}, x?: {id, username}, deny?: boolean} — 다음 인가 요청이 누구로 승인되는가 · 취소(access_denied)인가.
 */

export const FAKE_LINE = {
  clientId: '2001234567',
  clientSecret: '0123456789abcdef0123456789abcdef',
}
export const FAKE_X = { clientId: 'x-client', clientSecret: 'x-secret' }

type Grant = {
  challenge: string
  nonce?: string
  redirectUri: string
  user: Record<string, string | undefined>
  used: boolean
  provider: 'line' | 'x'
}

export type FakeProviders = { url: string; close: () => Promise<void> }

const b64 = (bytes: Buffer | string) => Buffer.from(bytes).toString('base64url')
const s256 = (verifier: string) => createHash('sha256').update(verifier).digest('base64url')

function body(req: IncomingMessage): Promise<string> {
  return new Promise((done) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => done(data))
  })
}

const json = (res: ServerResponse, status: number, value: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(value))
}

export async function startFakeProviders(): Promise<FakeProviders> {
  const grants = new Map<string, Grant>()
  const state = {
    line: { sub: 'U-e2e-line-1', name: 'LINE Tester', email: undefined as string | undefined },
    x: { id: 'x-e2e-1', username: 'x_tester' },
    deny: false,
  }
  let base = ''

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://fake')
    const path = url.pathname

    if (path === '/control' && req.method === 'POST') {
      const patch = JSON.parse((await body(req)) || '{}')
      if (patch.line) Object.assign(state.line, patch.line)
      if (patch.x) Object.assign(state.x, patch.x)
      if ('deny' in patch) state.deny = !!patch.deny
      return json(res, 200, state)
    }

    // 브라우저가 가는 인가 화면 — 사람 대신 바로 승인(또는 취소)하고 redirect_uri 로 돌려보낸다
    if (path === '/line/authorize' || path === '/x/authorize') {
      const provider = path.startsWith('/line') ? 'line' : 'x'
      const q = url.searchParams
      const redirect = q.get('redirect_uri') ?? ''
      const clientId = provider === 'line' ? FAKE_LINE.clientId : FAKE_X.clientId
      const back = new URL(redirect)
      if (q.get('state')) back.searchParams.set('state', q.get('state') as string)
      if (q.get('client_id') !== clientId) {
        back.searchParams.set('error', 'unauthorized_client')
        res.writeHead(302, { Location: back.toString() })
        return res.end()
      }
      // 진짜 제공자(LINE: REQUIRED, X: REQUIRED)처럼 PKCE 없이는 시작도 못 한다
      if (q.get('code_challenge_method') !== 'S256' || !q.get('code_challenge')) {
        back.searchParams.set('error', 'invalid_request')
        back.searchParams.set('error_description', 'code_challenge is required')
        res.writeHead(302, { Location: back.toString() })
        return res.end()
      }
      if (provider === 'line' && !q.get('nonce')) {
        back.searchParams.set('error', 'invalid_request')
        back.searchParams.set('error_description', 'nonce is required')
        res.writeHead(302, { Location: back.toString() })
        return res.end()
      }
      if (state.deny) {
        back.searchParams.set('error', 'access_denied')
        back.searchParams.set('error_description', 'The user denied the request')
        res.writeHead(302, { Location: back.toString() })
        return res.end()
      }
      const code = `${provider}-${randomUUID()}`
      grants.set(code, {
        provider,
        challenge: q.get('code_challenge') as string,
        nonce: q.get('nonce') ?? undefined,
        redirectUri: redirect,
        user: provider === 'line' ? { ...state.line } : { ...state.x },
        used: false,
      })
      back.searchParams.set('code', code)
      res.writeHead(302, { Location: back.toString() })
      return res.end()
    }

    if (path === '/line/token' && req.method === 'POST') {
      const f = new URLSearchParams(await body(req))
      if (
        f.get('client_id') !== FAKE_LINE.clientId ||
        f.get('client_secret') !== FAKE_LINE.clientSecret
      )
        return json(res, 400, { error: 'invalid_client' })
      const grant = grants.get(f.get('code') ?? '')
      if (!grant || grant.provider !== 'line' || grant.used)
        return json(res, 400, {
          error: 'invalid_grant',
          error_description: 'invalid authorization code',
        })
      grant.used = true
      // redirect_uri 는 인가 요청의 것과 글자 하나까지 같아야 한다(실제 제공자의 규칙) — 끝 슬래시 · http/https · 포트가 다르면 거절
      if (f.get('redirect_uri') !== grant.redirectUri)
        return json(res, 400, {
          error: 'invalid_grant',
          error_description: 'redirect_uri does not match',
        })
      if (!f.get('code_verifier') || s256(f.get('code_verifier') as string) !== grant.challenge)
        return json(res, 400, {
          error: 'invalid_grant',
          error_description: 'code_verifier does not match',
        })
      const now = Math.floor(Date.now() / 1000)
      const claims: Record<string, unknown> = {
        iss: `${base}/line`,
        aud: FAKE_LINE.clientId,
        exp: now + 600,
        iat: now,
        sub: grant.user.sub,
        nonce: grant.nonce,
        name: grant.user.name,
        amr: ['pwd'],
        ...(grant.user.email ? { email: grant.user.email } : {}),
      }
      const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      const payload = b64(JSON.stringify(claims))
      const sig = createHmac('sha256', FAKE_LINE.clientSecret)
        .update(`${head}.${payload}`)
        .digest('base64url')
      return json(res, 200, {
        access_token: 'line-at',
        expires_in: 2592000,
        id_token: `${head}.${payload}.${sig}`,
        refresh_token: 'rt',
        scope: 'profile openid',
        token_type: 'Bearer',
      })
    }
    if (path === '/line/certs') return json(res, 200, { keys: [] })

    if (path === '/x/2/oauth2/token' && req.method === 'POST') {
      const basic = (req.headers.authorization ?? '').replace(/^Basic /, '')
      if (Buffer.from(basic, 'base64').toString() !== `${FAKE_X.clientId}:${FAKE_X.clientSecret}`)
        return json(res, 401, { error: 'unauthorized_client' })
      const f = new URLSearchParams(await body(req))
      const grant = grants.get(f.get('code') ?? '')
      if (!grant || grant.provider !== 'x' || grant.used)
        return json(res, 400, {
          error: 'invalid_request',
          error_description: 'Value passed for the authorization code was invalid.',
        })
      grant.used = true
      if (f.get('redirect_uri') !== grant.redirectUri)
        return json(res, 400, {
          error: 'invalid_request',
          error_description: 'Value passed for the redirect uri did not match.',
        })
      if (!f.get('code_verifier') || s256(f.get('code_verifier') as string) !== grant.challenge)
        return json(res, 400, {
          error: 'invalid_request',
          error_description: 'Value passed for the code verifier was invalid.',
        })
      return json(res, 200, {
        token_type: 'bearer',
        expires_in: 7200,
        access_token: `x-at-${grant.user.id}`,
        scope: 'users.read tweet.read',
      })
    }
    if (path === '/x/2/users/me') {
      const id = (req.headers.authorization ?? '').replace('Bearer x-at-', '')
      return json(res, 200, { data: { id, name: `X ${id}`, username: state.x.username } })
    }
    json(res, 404, {})
  }

  const server: Server = createServer((req, res) => {
    handle(req, res).catch(() => json(res, 500, { error: 'fake provider crashed' }))
  })
  await new Promise<void>((done) => server.listen(0, 'localhost', done))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('fake providers: no port')
  base = `http://localhost:${address.port}`
  return {
    url: base,
    close: () => new Promise<void>((done) => server.close(() => done())),
  }
}
