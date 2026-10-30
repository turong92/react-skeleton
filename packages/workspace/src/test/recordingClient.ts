import type { ApiRequest } from '@skeleton/api-client'

export type Call = { kind: string; path: string; request?: ApiRequest }

/** 부른 경로 · 요청을 기록하고 정해 둔 값을 돌려주는 가짜 클라이언트(시험용) */
export function recordingClient(reply: unknown = {}) {
  const calls: Call[] = []
  const record =
    (kind: string) =>
    async (path: string, request?: ApiRequest): Promise<never> => {
      calls.push({ kind, path, request })
      return reply as never
    }
  return {
    calls,
    client: {
      value: record('value'),
      list: record('list'),
      noContent: async (path: string, request?: ApiRequest) => {
        calls.push({ kind: 'noContent', path, request })
      },
    },
  }
}
