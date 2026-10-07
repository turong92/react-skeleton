import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

/** 스토리용 TanStack Query 환경 — 스토리를 열 때마다 새 캐시로 시작한다(앱에서는 `main.tsx` 의 `QueryClientProvider`) */
export function WithQuery({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
