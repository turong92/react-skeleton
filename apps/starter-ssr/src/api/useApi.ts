import type { ApiClient } from '@skeleton/api-client'
import { useContext } from 'react'
import { ApiContext } from './apiContext'

export function useApi(): Pick<ApiClient, 'value' | 'list' | 'noContent' | 'page'> {
  const client = useContext(ApiContext)
  if (!client) throw new Error('useApi must be used inside <ApiProvider>')
  return client
}
