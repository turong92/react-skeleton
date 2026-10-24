import { useCallback } from 'react'
import { hasPermission } from './permissions'
import { useAuth } from './useAuth'

/** 지금 로그인한 사용자가 이 권한(들 중 하나)을 가졌나 - 숨기는 데만 쓴다. 익명이면 false */
export function usePermission(key: string | readonly string[]): boolean {
  const { principal } = useAuth()
  return hasPermission(principal?.permissions, key)
}

/** 부품에 넘기는 권한 질문 함수(`can={useCan()}`) - 같은 사용자 동안 같은 함수 */
export function useCan(): (key: string) => boolean {
  const { principal } = useAuth()
  const permissions = principal?.permissions
  return useCallback((key: string) => hasPermission(permissions, key), [permissions])
}
