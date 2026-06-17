import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Bell,
  BookOpen,
  Boxes,
  CheckCircle2,
  CircleStop,
  Copy,
  CreditCard,
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
import { API_BASE_URL, apiEndpoint, apiResponse, type ApiRequestInit } from '../api/client'
import { createTraceContext, createTraceId } from '../api/traceContext'
import {
  ApiRequestError,
  type ApiHttpResponse,
  type ApiListResponse,
  type ApiPageResponse,
  type ApiValueResponse,
} from '../api/types'
import type { AuthPrincipal, AuthTokenResponse } from '../api/types'
import {
  applyAuthHeaders,
  decodeTokenPrincipal,
  parseDevIdentity,
} from '../modules/auth/authSession'
import {
  canConnectNotificationWebSocket,
  createNotificationConnectFrame,
  createNotificationSubscribeFrames,
  parseNotificationMessage,
  type NotificationStompMessage,
} from '../modules/notifications/notificationStompSession'
import { readSseStream, type SseEvent } from '../modules/notifications/sseStream'
import {
  encodeStompFrame,
  parseStompFrames,
  websocketUrlFromApiBase,
} from '../modules/notifications/stompFrames'
import {
  ActionButton,
  ExchangeLog,
  PrincipalStrip,
  SectionTitle,
} from '../modules/workbench/components'
import {
  FALLBACK_WORKBENCH_MODULES,
  toWorkbenchModules,
} from '../modules/workbench/moduleCatalog'
import {
  skeletonWorkbenchClient,
  type SkeletonModuleResponse,
  type SkeletonNotificationPublishResponse,
  type SkeletonPaymentRouteResponse,
  type SkeletonRedisKeyResponse,
  type SkeletonStorageValidationResponse,
} from '../modules/workbench/skeletonWorkbenchClient'
import type { Exchange, SseStatus, WebSocketStatus } from '../modules/workbench/workbenchTypes'
import {
  formatJson,
  headersToObject,
  messageOf,
  newIdempotencyKey,
  nowMs,
  redactHeaders,
  summarizeRequest,
} from '../modules/workbench/workbenchUtils'
import { showApiError } from '../lib/showApiError'

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
  const [workbenchModules, setWorkbenchModules] = useState(FALLBACK_WORKBENCH_MODULES)
  const [moduleCatalogSource, setModuleCatalogSource] = useState<'fallback' | 'backend'>('fallback')
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [sseStatus, setSseStatus] = useState<SseStatus>('idle')
  const [sseEvents, setSseEvents] = useState<SseEvent[]>([])
  const [webSocketStatus, setWebSocketStatus] = useState<WebSocketStatus>('idle')
  const [webSocketEvents, setWebSocketEvents] = useState<NotificationStompMessage[]>([])
  const sseAbortRef = useRef<AbortController | null>(null)
  const webSocketRef = useRef<WebSocket | null>(null)
  const webSocketBufferRef = useRef('')
  const webSocketClosingRef = useRef(false)

  const devLogin = useMemo(() => parseDevIdentity(devIdentity), [devIdentity])
  const activePrincipal = useMemo(() => decodeTokenPrincipal(accessToken), [accessToken])

  useEffect(() => {
    return () => {
      sseAbortRef.current?.abort()
      webSocketClosingRef.current = true
      webSocketRef.current?.close()
    }
  }, [])

  useEffect(() => {
    const loadModuleCatalog = async () => {
      try {
        const modules = await skeletonWorkbenchClient.listModules({
          traceId: flowTraceId,
          ...(accessToken ? { accessToken } : { devLogin }),
        })
        setWorkbenchModules(toWorkbenchModules(modules))
        setModuleCatalogSource('backend')
      } catch {
        setWorkbenchModules(FALLBACK_WORKBENCH_MODULES)
        setModuleCatalogSource('fallback')
      }
    }

    void loadModuleCatalog()
  }, [accessToken, devLogin, flowTraceId])

  async function runJsonExchange<TEnvelope>(
    label: string,
    method: ApiRequestInit['method'],
    path: string,
    init?: ApiRequestInit,
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
        method: method ?? 'GET',
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
        method: method ?? 'GET',
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

  async function logModuleCatalog() {
    const response = await runJsonExchange<ApiListResponse<SkeletonModuleResponse>>(
      'skeleton.modules',
      'GET',
      '/skeleton/modules',
      authOptions(),
    )
    if (response) {
      setWorkbenchModules(toWorkbenchModules(response.envelope.values))
      setModuleCatalogSource('backend')
    }
  }

  async function callRedisKeySmoke() {
    await runJsonExchange<ApiValueResponse<SkeletonRedisKeyResponse>>(
      'skeleton.redis-key',
      'GET',
      '/skeleton/redis/key?value=orders:1',
      authOptions(),
    )
  }

  async function callStorageValidationSmoke() {
    await runJsonExchange<ApiValueResponse<SkeletonStorageValidationResponse>>(
      'skeleton.storage-validate',
      'POST',
      '/skeleton/storage/validate',
      {
        ...authOptions(),
        json: {
          fileName: 'avatar.png',
          contentType: 'image/png',
          sizeBytes: 12,
        },
      },
    )
  }

  async function callNotificationSmoke() {
    await runJsonExchange<ApiValueResponse<SkeletonNotificationPublishResponse>>(
      'skeleton.notification',
      'POST',
      '/skeleton/notifications',
      {
        ...authOptions(),
        json: {
          topic: 'demo',
          type: 'frontend-smoke',
          severity: 'INFO',
          title: 'Frontend smoke',
          message: 'React skeleton workbench ping',
          payload: { source: 'react-skeleton' },
        },
      },
    )
  }

  async function callPaymentRouteSmoke() {
    await runJsonExchange<ApiValueResponse<SkeletonPaymentRouteResponse>>(
      'skeleton.payment-route',
      'GET',
      '/skeleton/payments/route?amount=1000&currency=KRW&country=KR',
      authOptions(),
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

  function startWebSocket() {
    stopWebSocket()
    if (!canConnectNotificationWebSocket(accessToken)) {
      const traceContext = createTraceContext(flowTraceId)
      setWebSocketStatus('error')
      toast.error('websocket requires bearer token')
      pushExchange({
        label: 'notifications.websocket.blocked',
        method: 'CONNECT',
        path: '/ws/notifications',
        status: undefined,
        durationMs: 0,
        traceId: traceContext.traceId,
        request: {
          headers: {
            traceparent: traceContext.traceparent,
            'X-Trace-Id': traceContext.traceId,
          },
        },
        error: {
          code: 'MISSING_WEBSOCKET_TOKEN',
          message: 'Run auth.login before opening the WebSocket smoke connection.',
        },
      })
      return
    }
    const webSocketUrl = websocketUrlFromApiBase(API_BASE_URL, '/ws/notifications')
    const connectFrame = createNotificationConnectFrame(webSocketUrl, {
      accessToken,
    })
    const traceContext = createTraceContext(flowTraceId)
    const started = nowMs()
    webSocketClosingRef.current = false
    webSocketBufferRef.current = ''
    setWebSocketStatus('connecting')
    setWebSocketEvents([])

    try {
      const socket = new WebSocket(webSocketUrl, ['v12.stomp'])
      webSocketRef.current = socket

      socket.onopen = () => {
        socket.send(
          encodeStompFrame({
            ...connectFrame,
            headers: {
              ...connectFrame.headers,
              traceparent: traceContext.traceparent,
              'X-Trace-Id': traceContext.traceId,
            },
          }),
        )
        pushExchange({
          label: 'notifications.websocket',
          method: 'GET',
          path: '/ws/notifications',
          status: 101,
          durationMs: Math.round(nowMs() - started),
          traceId: traceContext.traceId,
          request: {
            url: webSocketUrl,
            headers: summarizeStompHeaders(connectFrame.headers),
          },
          response: { protocol: 'stomp.v12', phase: 'socket-open' },
        })
      }

      socket.onmessage = (event) => {
        if (typeof event.data !== 'string') return
        const parsed = parseStompFrames(webSocketBufferRef.current + event.data)
        webSocketBufferRef.current = parsed.remaining
        parsed.frames.forEach((frame) => {
          if (frame.command === 'CONNECTED') {
            setWebSocketStatus('open')
            createNotificationSubscribeFrames('demo').forEach((subscribeFrame) => {
              socket.send(encodeStompFrame(subscribeFrame))
            })
            return
          }
          if (frame.command === 'ERROR') {
            setWebSocketStatus('error')
            toast.error('websocket error')
            pushExchange({
              label: 'notifications.websocket.error',
              method: 'MESSAGE',
              path: frame.headers.message ?? '/ws/notifications',
              status: undefined,
              durationMs: Math.round(nowMs() - started),
              traceId: traceContext.traceId,
              request: { destination: frame.headers.destination },
              error: frame.body || frame.headers.message || frame.headers['content-type'],
            })
            return
          }
          const notification = parseNotificationMessage(frame)
          if (notification) {
            setWebSocketEvents((current) => [notification, ...current].slice(0, 8))
          }
        })
      }

      socket.onerror = () => {
        setWebSocketStatus('error')
        toast.error('websocket connection failed')
      }

      socket.onclose = () => {
        if (webSocketRef.current === socket) {
          webSocketRef.current = null
        }
        webSocketBufferRef.current = ''
        if (!webSocketClosingRef.current) {
          setWebSocketStatus('idle')
        }
      }
    } catch (error) {
      setWebSocketStatus('error')
      showApiError(error)
    }
  }

  function stopWebSocket() {
    const socket = webSocketRef.current
    webSocketClosingRef.current = true
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(encodeStompFrame({ command: 'DISCONNECT', headers: { receipt: 'disconnect' } }))
    }
    socket?.close()
    webSocketRef.current = null
    webSocketBufferRef.current = ''
    setWebSocketStatus('idle')
  }

  async function callWebSocketNotificationSmoke() {
    const userId = activePrincipal?.accountId ?? 'acc_user'
    await runJsonExchange<ApiValueResponse<SkeletonNotificationPublishResponse>>(
      'skeleton.websocket-notification',
      'POST',
      '/skeleton/notifications',
      {
        ...authOptions(),
        json: {
          topic: 'demo',
          type: 'frontend-websocket-smoke',
          severity: 'INFO',
          title: 'WebSocket smoke',
          message: 'React skeleton WebSocket ping',
          payload: { source: 'react-skeleton', userId },
        },
      },
    )
  }

  function authOptions(): ApiRequestInit {
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

  function summarizeStompHeaders(
    headers: Record<string, string | number | undefined> | undefined,
  ): Record<string, string> {
    return redactHeaders({
      Authorization: headers?.Authorization ? 'Bearer ...' : undefined,
      'X-Dev-Account-Id': stringHeader(headers?.['X-Dev-Account-Id']),
      'X-Dev-Username': stringHeader(headers?.['X-Dev-Username']),
      'X-Dev-Email': stringHeader(headers?.['X-Dev-Email']),
      'accept-version': stringHeader(headers?.['accept-version']),
      'heart-beat': stringHeader(headers?.['heart-beat']),
      host: stringHeader(headers?.host),
    })
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
          <div className="realtime-grid">
            <div className="stream-card">
              <div className="realtime-meter">
                <span data-status={sseStatus}>{sseStatus}</span>
                <code>/notifications/sse?topic=demo</code>
              </div>
              <div className="button-row">
                <ActionButton
                  label="sse"
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
                  <code>no sse events</code>
                ) : (
                  sseEvents.map((event) => (
                    <pre key={event.id}>{formatJson({ event: event.name, data: event.data })}</pre>
                  ))
                )}
              </div>
            </div>

            <div className="stream-card">
              <div className="realtime-meter">
                <span data-status={webSocketStatus}>{webSocketStatus}</span>
                <code>/ws/notifications</code>
              </div>
              <div className="button-row">
                <ActionButton
                  label="ws"
                  icon={<Play size={16} />}
                  disabled={webSocketStatus === 'connecting' || webSocketStatus === 'open'}
                  busy={webSocketStatus === 'connecting'}
                  onClick={startWebSocket}
                />
                <ActionButton
                  label="stop"
                  icon={<CircleStop size={16} />}
                  disabled={webSocketStatus === 'idle'}
                  onClick={stopWebSocket}
                />
                <ActionButton
                  label="publish"
                  icon={<Bell size={16} />}
                  disabled={webSocketStatus !== 'open'}
                  busy={busyAction === 'skeleton.websocket-notification'}
                  onClick={callWebSocketNotificationSmoke}
                />
              </div>
              <div className="event-stack">
                {webSocketEvents.length === 0 ? (
                  <code>no websocket events</code>
                ) : (
                  webSocketEvents.map((event, index) => (
                    <pre key={`${event.destination ?? 'message'}-${index}`}>
                      {formatJson(event)}
                    </pre>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="module-section" aria-label="module map">
        <SectionTitle icon={<Database size={18} />} title="Module map" />
        <div className="module-toolbar">
          <span data-source={moduleCatalogSource}>{moduleCatalogSource}</span>
          <div className="button-row">
            <ActionButton
              label="refresh"
              icon={<RefreshCcw size={16} />}
              busy={busyAction === 'skeleton.modules'}
              onClick={logModuleCatalog}
            />
            <ActionButton
              label="redis key"
              icon={<Database size={16} />}
              busy={busyAction === 'skeleton.redis-key'}
              onClick={callRedisKeySmoke}
            />
            <ActionButton
              label="storage"
              icon={<FileJson size={16} />}
              busy={busyAction === 'skeleton.storage-validate'}
              onClick={callStorageValidationSmoke}
            />
            <ActionButton
              label="notify"
              icon={<Bell size={16} />}
              busy={busyAction === 'skeleton.notification'}
              onClick={callNotificationSmoke}
            />
            <ActionButton
              label="payment"
              icon={<CreditCard size={16} />}
              busy={busyAction === 'skeleton.payment-route'}
              onClick={callPaymentRouteSmoke}
            />
          </div>
        </div>
        <div className="module-grid">
          {workbenchModules.map((module) => (
            <article className="module-card" key={module.title}>
              <div>
                <strong>{module.title}</strong>
                <span data-status={module.status}>{module.status}</span>
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

async function copy(value: string) {
  await navigator.clipboard.writeText(value)
  toast.success('copied')
}

function stringHeader(value: string | number | undefined): string | undefined {
  return value === undefined ? undefined : String(value)
}
