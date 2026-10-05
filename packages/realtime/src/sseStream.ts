export type SseEvent = {
  id: string
  name: string
  data: unknown
}

export async function readSseStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  onEvent: (event: SseEvent) => void,
  /** 바이트가 올 때마다(심장박동 주석 포함) — 유휴 감시용 */
  onChunk?: () => void,
) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (!signal.aborted) {
    const { value, done } = await reader.read()
    if (done) break
    onChunk?.()
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''
    blocks
      .map(parseSseBlock)
      .filter((event): event is SseEvent => event !== null)
      .forEach(onEvent)
  }
}

export function parseSseBlock(block: string): SseEvent | null {
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

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
