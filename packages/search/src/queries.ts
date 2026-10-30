import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { isSearchable } from './query'
import type { SearchApi } from './searchApi'
import type { SearchParams } from './types'

export const searchKeys = {
  all: ['search'] as const,
  list: (params: SearchParams) => [...searchKeys.all, 'list', params] as const,
}

/** 값이 멈춘 지 `delayMs` 뒤에 따라온다 - 처음 값은 바로(첫 그림이 늦지 않게) */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    if (delayMs <= 0) return
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return delayMs <= 0 ? value : settled
}

export type UseSearchOptions = {
  /** 입력이 멈춘 뒤 이만큼(ms) 지나야 서버에 묻는다(기본 300, 0 이면 바로) */
  delayMs?: number
}

/**
 * 검색 한 쪽 - 입력이 멈출 때까지 늦추고, 2글자 미만이면 묻지 않으며(`searchable` 가 false),
 * 조건을 바꾸는 동안 앞 쪽을 그대로 보여 준다(깜빡임 없이).
 * `settling` 은 입력은 바뀌었는데 아직 묻지 않은 동안.
 */
export function useSearch(
  api: Pick<SearchApi, 'search'>,
  params: SearchParams,
  { delayMs = 300 }: UseSearchOptions = {},
) {
  const q = params.q.trim()
  const delayed = useDebouncedValue(q, delayMs)
  const sent = { ...params, q: delayed }
  const query = useQuery({
    queryKey: searchKeys.list(sent),
    queryFn: () => api.search(sent),
    enabled: isSearchable(delayed),
    placeholderData: keepPreviousData,
  })
  return { query, searchable: isSearchable(q), settling: delayed !== q }
}
