import type { ApiClient } from '@skeleton/api-client'
import type { ReactNode } from 'react'
import { ApiContext } from './apiContext'

/** 이 클라이언트를 아래 모든 훅(`useApi`)에 내려준다 */
export function ApiProvider({
  client,
  children,
}: {
  client: Pick<ApiClient, 'value' | 'list' | 'noContent' | 'page'>
  children: ReactNode
}) {
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>
}
