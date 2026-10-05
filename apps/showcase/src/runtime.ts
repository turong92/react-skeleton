import { createAuthSession, createTokenStore } from '@skeleton/auth'
import { QueryClient } from '@tanstack/react-query'
import { createContext, useContext } from 'react'
import { createFakeAuthApi } from './fakes/fakeAuthApi'
import { createFakeInbox } from './fakes/fakeInbox'

/** 데모가 함께 쓰는 가짜 세계 — 백엔드 없이 인증 · 받은편지함이 돈다 */
export function createShowcaseRuntime() {
  return {
    session: createAuthSession({ api: createFakeAuthApi(), store: createTokenStore() }),
    inbox: createFakeInbox(),
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }
}
export type ShowcaseRuntime = ReturnType<typeof createShowcaseRuntime>

export const RuntimeContext = createContext<ShowcaseRuntime | null>(null)

export function useRuntime(): ShowcaseRuntime {
  const runtime = useContext(RuntimeContext)
  if (!runtime) throw new Error('useRuntime must be used inside <ShowcaseProviders>')
  return runtime
}
