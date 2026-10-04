export type StompCommand =
  | 'CONNECT'
  | 'CONNECTED'
  | 'SUBSCRIBE'
  | 'SEND'
  | 'MESSAGE'
  | 'ERROR'
  | 'DISCONNECT'

export type StompFrame = {
  command: StompCommand | string
  headers?: Record<string, string | number | undefined>
  body?: unknown
}

export type ParsedStompFrame = {
  command: string
  headers: Record<string, string>
  body: string
}

export function encodeStompFrame(frame: StompFrame): string {
  const headers = Object.entries(frame.headers ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `${escapeHeader(name)}:${escapeHeader(String(value))}`)
    .join('\n')
  const body =
    frame.body === undefined || typeof frame.body === 'string'
      ? (frame.body ?? '')
      : JSON.stringify(frame.body)
  return `${frame.command}\n${headers}\n\n${body}\u0000`
}

export function parseStompFrames(buffer: string): {
  frames: ParsedStompFrame[]
  remaining: string
} {
  const parts = buffer.split('\u0000')
  const remaining = parts.pop() ?? ''
  return {
    frames: parts.map(parseStompFrame).filter((frame): frame is ParsedStompFrame => frame !== null),
    remaining,
  }
}

export function websocketUrlFromApiBase(apiBaseUrl: string, endpointPath: string): string {
  const base = new URL(apiBaseUrl, runtimeOrigin())
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:'
  base.pathname = normalizeEndpoint(endpointPath)
  base.search = ''
  base.hash = ''
  return base.toString()
}

function runtimeOrigin(): string {
  return globalThis.location?.origin ?? 'http://localhost'
}

function parseStompFrame(rawFrame: string): ParsedStompFrame | null {
  const trimmed = rawFrame.replace(/^\n+/, '')
  if (!trimmed) return null
  const separator = trimmed.indexOf('\n\n')
  const headerBlock = separator >= 0 ? trimmed.slice(0, separator) : trimmed
  const body = separator >= 0 ? trimmed.slice(separator + 2) : ''
  const [command = '', ...headerLines] = headerBlock.split('\n')
  if (!command) return null
  return {
    command,
    headers: Object.fromEntries(
      headerLines.filter(Boolean).map((line) => {
        const separatorIndex = line.indexOf(':')
        if (separatorIndex < 0) return [unescapeHeader(line), '']
        return [
          unescapeHeader(line.slice(0, separatorIndex)),
          unescapeHeader(line.slice(separatorIndex + 1)),
        ]
      }),
    ),
    body,
  }
}

function normalizeEndpoint(endpointPath: string): string {
  const trimmed = endpointPath.trim()
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function escapeHeader(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(':', '\\c')
}

function unescapeHeader(value: string): string {
  return value.replaceAll('\\c', ':').replaceAll('\\n', '\n').replaceAll('\\\\', '\\')
}
