import { useEffect, useRef } from 'react'
import type { AuthorMemory } from './authorMemory'
import { resolveInitial, threadOverridesAuto, type AutoValue } from './initialAuthor'
import type { AuthorProfile } from './types'

/**
 * 선택기의 값 자동 채우기 — 비어 있으면 ① 이 스레드 ② 이 기기 기억으로 채우고(어디서 왔는지 기억한다), 값이 더는 내 프로필이 아니면(다른 탭에서 지움) 비운다.
 * 기억(②)에서 온 값만 스레드가 나중에 다른 내 프로필을 알려 오면(재시도 · 쪽 넘김) 스레드 값으로 다시 정한다. 스레드(①)가 정한 값 · 사람이 고른 값은 건드리지 않는다.
 * `chosen()` 은 사람이 값을 정했다고(고르기 · 다시 고르기 · 유지) 표시한다.
 */
export function useAutoAuthor({
  profiles,
  value,
  onChange,
  threadAuthorId,
  threadLoading,
  memory,
  boardCode,
}: {
  profiles: readonly AuthorProfile[]
  value: string | undefined
  onChange: (authorId: string | undefined) => void
  threadAuthorId: string | undefined
  threadLoading: boolean
  memory: AuthorMemory | undefined
  boardCode: string
}) {
  const auto = useRef<AutoValue>(undefined)
  const known = value !== undefined && profiles.some((profile) => profile.id === value)

  useEffect(() => {
    if (value !== undefined && !known) {
      auto.current = undefined
      onChange(undefined)
      return
    }
    if (value === undefined) {
      const initial = resolveInitial({
        profiles,
        threadAuthorId,
        remembered: memory?.get(boardCode),
        threadLoading,
      })
      if (initial !== undefined) {
        auto.current = initial
        onChange(initial.id)
      }
      return
    }
    const overriding = threadOverridesAuto({
      profiles,
      value,
      auto: auto.current,
      threadAuthorId,
      threadLoading,
    })
    if (overriding !== undefined) {
      auto.current = { id: overriding, source: 'thread' }
      onChange(overriding)
    }
  }, [value, known, profiles, threadAuthorId, threadLoading, memory, boardCode, onChange])

  return {
    /** 사람이 값을 정했다 — 이 뒤로 스레드가 덮지 않는다 */
    chosen: () => {
      auto.current = undefined
    },
  }
}
