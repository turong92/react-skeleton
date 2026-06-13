export type Exchange = {
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

export type SseStatus = 'idle' | 'connecting' | 'open' | 'error'

export type WebSocketStatus = 'idle' | 'connecting' | 'open' | 'error'

export type WorkbenchModule = {
  title: string
  status: 'wired' | 'split' | 'active' | 'disabled' | 'missing'
  group?: string
  details: string[]
}
