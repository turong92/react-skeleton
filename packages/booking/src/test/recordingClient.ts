import type { ApiRequest } from '@skeleton/api-client'

export type Call = { kind: string; path: string; request?: ApiRequest }

/** 부른 경로 · 요청을 기록하고 정해 둔 값을 돌려주는 가짜 클라이언트(시험용) */
export function recordingClient(reply: unknown = {}) {
  const calls: Call[] = []
  return {
    calls,
    client: {
      noContent: async (path: string, request?: ApiRequest): Promise<void> => {
        calls.push({ kind: 'noContent', path, request })
      },
      list: async (path: string, request?: ApiRequest): Promise<never> => {
        calls.push({ kind: 'list', path, ...(request ? { request } : {}) })
        return reply as never
      },
      endpoint: (path: string) => `http://api.test/api/v1${path}`,
      value: async (path: string, request?: ApiRequest): Promise<never> => {
        calls.push({ kind: 'value', path, request })
        return reply as never
      },
    },
  }
}
