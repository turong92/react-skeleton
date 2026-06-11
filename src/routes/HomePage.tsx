import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Activity,
  Bell,
  BookOpen,
  Boxes,
  CheckCircle2,
  CircleStop,
  Copy,
  Database,
  FileJson,
  KeyRound,
  LockKeyhole,
  Play,
  Plus,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiEndpoint, apiResponse } from '../api/client'
import { createTraceContext, createTraceId } from '../api/traceContext'
import {
  ApiRequestError,
  type ApiHttpResponse,
  type ApiPageResponse,
  type ApiValueResponse,
} from '../api/types'
import type { AuthPrincipal, AuthTokenResponse, DevLoginIdentity } from '../api/types'
import { showApiError } from '../lib/showApiError'

type ApiResponseInit = Parameters<typeof apiResponse>[1]

type HelloResponse = {
  message: string
  timestamp: string
}

type ExampleItemResponse = {
  id: string
  name: string
}

type ExampleJobResponse = {
  jobId: string
  status: string
}

type Exchange = {
  id: string
  at: string
  label: string
  method: string
  path: string
  status?: number
  durationMs: number
  traceId?: string
  spanId?: string
  request: unknown
  response?: unknown
  error?: unknown
}

type SseStatus = 'idle' | 'connecting' | 'open' | 'error'

type SseEvent = {
  id: string
  name: string
  data: unknown
}

const MODULES = [
  {
    title: 'platform',
    status: 'wired',
    details: ['Response.ok', 'traceparent', 'Swagger', 'Problem Details'],
  },
  {
    title: 'auth',
    status: 'wired',
    details: ['JWT', 'dev login', 'break-glass', 'stateless'],
  },
  {
    title: 'web',
    status: 'wired',
    details: ['CORS', 'public endpoints', 'rate limit', 'headers'],
  },
  {
    title: 'notification',
    status: 'split',
    details: ['SSE', 'WebSocket', 'Slack alert'],
  },
  {
    title: 'redis',
    status: 'split',
    details: ['cache', 'rate-limit', 'lock retry'],
  },
  {
    title: 'storage',
    status: 'split',
    details: ['core contract', 'S3 presign'],
  },
  {
    title: 'event',
    status: 'split',
    details: ['Spring event', 'Kafka bridge', 'trace headers'],
  },
  {
    title: 'payment',
    status: 'split',
    details: ['router', 'Toss', 'Stripe'],
  },
]

export function HomePage() {
  const [flowTraceId, setFlowTraceId] = useState(createTraceId)
  const [accessToken, setAccessToken] = useState('')
  const [loginEmail, setLoginEmail] = useState('user@example.com')
  const [loginPassword, setLoginPassword] = useState('password')
  const [devIdentity, setDevIdentity] = useState('user@example.com')
  const [itemName, setItemName] = useState('sample-from-fe')
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)
  const [breakGlassSecret, setBreakGlassSecret] = useState('')
  const [breakGlassReason, setBreakGlassReason] = useState('production support')
  const [breakGlassAccountId, setBreakGlassAccountId] = useState('acc_admin')
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [sseStatus, setSseStatus] = useState<SseStatus>('idle')
  const [sseEvents, setSseEvents] = useState<SseEvent[]>([])
  const sseAbortRef = useRef<AbortController | null>(null)

  const devLogin = useMemo(() => parseDevIdentity(devIdentity), [devIdentity])
  const activePrincipal = useMemo(() => decodeTokenPrincipal(accessToken), [accessToken])

  useEffect(() => {
    return () => {
      sseAbortRef.current?.abort()
    }
  }, [])

  async function runJsonExchange<TEnvelope>(
    label: string,
    method: string,
    path: string,
    init?: ApiResponseInit,
  ): Promise<ApiHttpResponse<TEnvelope> | null> {
    const started = nowMs()
    setBusyAction(label)
    try {
      const response = await apiResponse<TEnvelope>(path, {
        ...init,
        method,
        traceId: flowTraceId,
      })
      pushExchange({
        label,
        method,
        path,
        status: response.status,
        durationMs: Math.round(nowMs() - started),
        traceId: response.trace.traceId,
        spanId: response.trace.spanId,
        request: summarizeRequest(init),
        response: response.envelope,
      })
      return response
    } catch (error) {
      showApiError(error)
      pushExchange({
        label,
        method,
        path,
        status: error instanceof ApiRequestError ? error.apiError.status : undefined,
        durationMs: Math.round(nowMs() - started),
        traceId: error instanceof ApiRequestError ? error.traceId : flowTraceId,
        spanId: error instanceof ApiRequestError ? error.spanId : undefined,
        request: summarizeRequest(init),
        error: error instanceof ApiRequestError ? error.apiError : messageOf(error),
      })
      return null
    } finally {
      setBusyAction(null)
    }
  }

  async function callHello() {
    await runJsonExchange<ApiValueResponse<HelloResponse>>('hello', 'GET', '/hello')
  }

  async function callItems() {
    await runJsonExchange<ApiPageResponse<ExampleItemResponse>>(
      'items.page',
      'GET',
      '/examples/items?page=0&size=3',
      authOptions(),
    )
  }

  async function createItem() {
    const response = await runJsonExchange<ApiValueResponse<ExampleItemResponse>>(
      'items.create',
      'POST',
      '/examples/items',
      {
        ...authOptions(),
        idempotencyKey,
        json: { name: itemName },
      },
    )
    if (response) {
      setIdempotencyKey(newIdempotencyKey())
    }
  }

  async function startJob() {
    await runJsonExchange<ApiValueResponse<ExampleJobResponse>>(
      'jobs.start',
      'POST',
      '/examples/jobs',
      authOptions(),
    )
  }

  async function passwordLogin() {
    const response = await runJsonExchange<ApiValueResponse<AuthTokenResponse>>(
      'auth.login',
      'POST',
      '/auth/login',
      {
        json: { email: loginEmail, password: loginPassword },
      },
    )
    const token = response?.envelope.value.accessToken
    if (token) {
      setAccessToken(token)
      toast.success('access token captured')
    }
  }

  async function callMeWithBearer() {
    await runJsonExchange<ApiValueResponse<AuthPrincipal>>('auth.me.bearer', 'GET', '/auth/me', {
      accessToken,
    })
  }

  async function callMeWithDevLogin() {
    await runJsonExchange<ApiValueResponse<AuthPrincipal>>('auth.me.dev', 'GET', '/auth/me', {
      devLogin,
    })
  }

  async function callMeWithBreakGlass() {
    await runJsonExchange<ApiValueResponse<AuthPrincipal>>(
      'auth.me.break-glass',
      'GET',
      '/auth/me',
      {
        breakGlass: {
          accountId: breakGlassAccountId,
          reason: breakGlassReason,
          secret: breakGlassSecret,
        },
      },
    )
  }

  async function startSse() {
    sseAbortRef.current?.abort()
    const abortController = new AbortController()
    const traceContext = createTraceContext(flowTraceId)
    const headers = new Headers({
      Accept: 'text/event-stream',
      traceparent: traceContext.traceparent,
      'X-Trace-Id': traceContext.traceId,
    })
    applyAuthHeaders(headers, accessToken, devLogin)
    sseAbortRef.current = abortController
    setSseStatus('connecting')
    setSseEvents([])
    const started = nowMs()

    try {
      const response = await fetch(apiEndpoint('/notifications/sse?topic=demo'), {
        headers,
        signal: abortController.signal,
      })
      pushExchange({
        label: 'notifications.sse',
        method: 'GET',
        path: '/notifications/sse?topic=demo',
        status: response.status,
        durationMs: Math.round(nowMs() - started),
        traceId: response.headers.get('X-Trace-Id') ?? traceContext.traceId,
        spanId: response.headers.get('X-Span-Id') ?? undefined,
        request: { headers: redactHeaders(headersToObject(headers)) },
        response: { contentType: response.headers.get('content-type') },
      })

      if (!response.ok || !response.body) {
        setSseStatus('error')
        return
      }

      setSseStatus('open')
      await readSseStream(response.body, abortController.signal, (event) => {
        setSseEvents((current) => [event, ...current].slice(0, 8))
      })
    } catch (error) {
      if (!abortController.signal.aborted) {
        setSseStatus('error')
        showApiError(error)
      }
    } finally {
      if (sseAbortRef.current === abortController) {
        sseAbortRef.current = null
      }
    }
  }

  function stopSse() {
    sseAbortRef.current?.abort()
    sseAbortRef.current = null
    setSseStatus('idle')
  }

  function authOptions() {
    return accessToken ? { accessToken } : { devLogin }
  }

  function pushExchange(exchange: Omit<Exchange, 'id' | 'at'>) {
    setExchanges((current) =>
      [
        {
          ...exchange,
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 10),
    )
  }

  return (
    <div className="workbench">
      <section className="trace-band" aria-label="trace workspace">
        <div>
          <p className="eyebrow">active flow</p>
          <h1>Kotlin skeleton control plane</h1>
        </div>
        <div className="trace-control">
          <code>{flowTraceId}</code>
          <button
            type="button"
            className="icon-button"
            title="copy traceId"
            onClick={() => copy(flowTraceId)}
          >
            <Copy size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            title="new traceId"
            onClick={() => setFlowTraceId(createTraceId())}
          >
            <RefreshCcw size={16} />
          </button>
        </div>
      </section>

      <section className="control-grid">
        <div className="command-panel">
          <SectionTitle icon={<Activity size={18} />} title="REST contract" />
          <div className="form-grid">
            <label>
              <span>item name</span>
              <input value={itemName} onChange={(event) => setItemName(event.target.value)} />
            </label>
            <label>
              <span>idempotency key</span>
              <input
                value={idempotencyKey}
                onChange={(event) => setIdempotencyKey(event.target.value)}
              />
            </label>
          </div>
          <div className="button-row">
            <ActionButton
              label="hello"
              icon={<Play size={16} />}
              busy={busyAction === 'hello'}
              onClick={callHello}
            />
            <ActionButton
              label="page"
              icon={<FileJson size={16} />}
              busy={busyAction === 'items.page'}
              onClick={callItems}
            />
            <ActionButton
              label="create"
              icon={<Plus size={16} />}
              busy={busyAction === 'items.create'}
              onClick={createItem}
            />
            <ActionButton
              label="job"
              icon={<Boxes size={16} />}
              busy={busyAction === 'jobs.start'}
              onClick={startJob}
            />
          </div>
        </div>

        <div className="command-panel">
          <SectionTitle icon={<KeyRound size={18} />} title="Auth" />
          <div className="form-grid">
            <label>
              <span>email</span>
              <input value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} />
            </label>
            <label>
              <span>password</span>
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
              />
            </label>
            <label>
              <span>dev login</span>
              <select value={devIdentity} onChange={(event) => setDevIdentity(event.target.value)}>
                <option value="user@example.com">user@example.com</option>
                <option value="admin@example.com">admin@example.com</option>
                <option value="acc_user">acc_user</option>
                <option value="acc_admin">acc_admin</option>
              </select>
            </label>
            <label>
              <span>token</span>
              <input value={accessToken} onChange={(event) => setAccessToken(event.target.value)} />
            </label>
          </div>
          <div className="button-row">
            <ActionButton
              label="login"
              icon={<KeyRound size={16} />}
              busy={busyAction === 'auth.login'}
              onClick={passwordLogin}
            />
            <ActionButton
              label="bearer me"
              icon={<ShieldCheck size={16} />}
              disabled={!accessToken}
              busy={busyAction === 'auth.me.bearer'}
              onClick={callMeWithBearer}
            />
            <ActionButton
              label="dev me"
              icon={<CheckCircle2 size={16} />}
              busy={busyAction === 'auth.me.dev'}
              onClick={callMeWithDevLogin}
            />
          </div>
          <PrincipalStrip principal={activePrincipal} />
        </div>

        <div className="command-panel">
          <SectionTitle icon={<LockKeyhole size={18} />} title="Break-glass" />
          <div className="form-grid">
            <label>
              <span>accountId</span>
              <input
                value={breakGlassAccountId}
                onChange={(event) => setBreakGlassAccountId(event.target.value)}
              />
            </label>
            <label>
              <span>reason</span>
              <input
                value={breakGlassReason}
                onChange={(event) => setBreakGlassReason(event.target.value)}
              />
            </label>
            <label className="wide-field">
              <span>secret</span>
              <input
                type="password"
                value={breakGlassSecret}
                onChange={(event) => setBreakGlassSecret(event.target.value)}
              />
            </label>
          </div>
          <div className="button-row">
            <ActionButton
              label="break me"
              icon={<LockKeyhole size={16} />}
              disabled={!breakGlassSecret || !breakGlassReason || !breakGlassAccountId}
              busy={busyAction === 'auth.me.break-glass'}
              onClick={callMeWithBreakGlass}
            />
          </div>
        </div>

        <div className="command-panel">
          <SectionTitle icon={<Bell size={18} />} title="Realtime" />
          <div className="realtime-meter">
            <span data-status={sseStatus}>{sseStatus}</span>
            <code>/notifications/sse?topic=demo</code>
          </div>
          <div className="button-row">
            <ActionButton
              label="stream"
              icon={<Play size={16} />}
              disabled={sseStatus === 'connecting' || sseStatus === 'open'}
              busy={sseStatus === 'connecting'}
              onClick={startSse}
            />
            <ActionButton
              label="stop"
              icon={<CircleStop size={16} />}
              disabled={sseStatus === 'idle'}
              onClick={stopSse}
            />
          </div>
          <div className="event-stack">
            {sseEvents.length === 0 ? (
              <code>no events</code>
            ) : (
              sseEvents.map((event) => (
                <pre key={event.id}>{formatJson({ event: event.name, data: event.data })}</pre>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="module-section" aria-label="module map">
        <SectionTitle icon={<Database size={18} />} title="Module map" />
        <div className="module-grid">
          {MODULES.map((module) => (
            <article className="module-card" key={module.title}>
              <div>
                <strong>{module.title}</strong>
                <span>{module.status}</span>
              </div>
              <ul>
                {module.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="exchange-section" aria-label="request response log">
        <SectionTitle icon={<BookOpen size={18} />} title="Request / Response" />
        <div className="exchange-list">
          {exchanges.length === 0 ? (
            <div className="empty-log">no exchanges</div>
          ) : (
            exchanges.map((exchange) => <ExchangeLog exchange={exchange} key={exchange.id} />)
          )}
        </div>
      </section>
    </div>
  )
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="section-title">
      {icon}
      <h2>{title}</h2>
    </div>
  )
}

function ActionButton({
  label,
  icon,
  busy,
  disabled,
  onClick,
}: {
  label: string
  icon: ReactNode
  busy?: boolean
  disabled?: boolean
  onClick: () => void | Promise<void>
}) {
  return (
    <button
      type="button"
      className="action-button"
      disabled={disabled || busy}
      onClick={onClick}
      title={label}
    >
      {busy ? <RefreshCcw size={16} className="spin" /> : icon}
      <span>{label}</span>
    </button>
  )
}

function PrincipalStrip({ principal }: { principal: AuthPrincipal | null }) {
  if (!principal) {
    return <div className="principal-strip">no bearer principal</div>
  }
  return (
    <div className="principal-strip">
      <strong>{principal.accountId}</strong>
      <span>{principal.email}</span>
      <span>{principal.roles.join(', ')}</span>
    </div>
  )
}

function ExchangeLog({ exchange }: { exchange: Exchange }) {
  return (
    <article className="exchange-item">
      <header>
        <div>
          <strong>{exchange.label}</strong>
          <code>
            {exchange.method} {exchange.path}
          </code>
        </div>
        <span data-ok={exchange.status !== undefined && exchange.status < 400}>
          {exchange.status ?? 'ERR'} · {exchange.durationMs}ms
        </span>
      </header>
      <div className="trace-row">
        <code>traceId={exchange.traceId ?? '-'}</code>
        <code>spanId={exchange.spanId ?? '-'}</code>
        <button
          type="button"
          className="icon-button"
          title="copy exchange"
          onClick={() => copy(formatJson(exchange))}
        >
          <Copy size={14} />
        </button>
      </div>
      <div className="json-grid">
        <pre>{formatJson({ request: exchange.request })}</pre>
        <pre>
          {formatJson(exchange.error ? { error: exchange.error } : { response: exchange.response })}
        </pre>
      </div>
    </article>
  )
}

function parseDevIdentity(value: string): DevLoginIdentity {
  if (value.includes('@')) return { email: value }
  if (value.startsWith('acc_')) return { accountId: value }
  return { username: value }
}

function applyAuthHeaders(headers: Headers, accessToken: string, devLogin: DevLoginIdentity) {
  if (accessToken) {
    headers.set(
      'Authorization',
      accessToken.startsWith('Bearer ') ? accessToken : `Bearer ${accessToken}`,
    )
    return
  }
  if (devLogin.accountId) headers.set('X-Dev-Account-Id', devLogin.accountId)
  if (devLogin.username) headers.set('X-Dev-Username', devLogin.username)
  if (devLogin.email) headers.set('X-Dev-Email', devLogin.email)
}

async function readSseStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  onEvent: (event: SseEvent) => void,
) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (!signal.aborted) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''
    blocks
      .map(parseSseBlock)
      .filter((event): event is SseEvent => event !== null)
      .forEach(onEvent)
  }
}

function parseSseBlock(block: string): SseEvent | null {
  const lines = block.split('\n')
  const id =
    lines
      .find((line) => line.startsWith('id:'))
      ?.slice(3)
      .trim() ?? crypto.randomUUID()
  const name =
    lines
      .find((line) => line.startsWith('event:'))
      ?.slice(6)
      .trim() ?? 'message'
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n')
  if (!data) return null
  return {
    id,
    name,
    data: parseJson(data),
  }
}

function summarizeRequest(init: ApiResponseInit) {
  return {
    headers: redactHeaders({
      Authorization: init?.accessToken ? 'Bearer ...' : undefined,
      'Idempotency-Key': init?.idempotencyKey,
      'X-Dev-Account-Id': init?.devLogin?.accountId,
      'X-Dev-Username': init?.devLogin?.username,
      'X-Dev-Email': init?.devLogin?.email,
      'X-Break-Glass-Account-Id': init?.breakGlass?.accountId,
      'X-Break-Glass-Reason': init?.breakGlass?.reason,
      'X-Break-Glass-Secret': init?.breakGlass?.secret,
    }),
    body: init?.json,
  }
}

function redactHeaders(headers: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(headers)
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
      .map(([key, value]) => [key, key.toLowerCase().includes('secret') ? '[REDACTED]' : value]),
  )
}

function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    result[key] = value
  })
  return result
}

function decodeTokenPrincipal(token: string): AuthPrincipal | null {
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const json = JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/'))) as {
      sub?: string
      username?: string
      email?: string
      roles?: string[]
    }
    return {
      accountId: json.sub ?? '-',
      username: json.username ?? '-',
      email: json.email ?? '-',
      roles: json.roles ?? [],
    }
  } catch {
    return null
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function newIdempotencyKey(): string {
  return `fe-${crypto.randomUUID()}`
}

function nowMs(): number {
  return performance.now()
}

async function copy(value: string) {
  await navigator.clipboard.writeText(value)
  toast.success('copied')
}
