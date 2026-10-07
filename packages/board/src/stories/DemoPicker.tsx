import { Button, Select } from '@skeleton/ui'
import { useEffect, useRef, useState } from 'react'
import type { AuthorPickerArgs } from '../authorship'
import type { DemoProfile } from './demoAuthorPicker'

/*
 * 스토리 · 시험용 작성자 선택기 — 보드는 선택기가 무엇인지 모른다(`authorPicker` 는 렌더 함수 하나). 진짜 선택기는 작성자 프로필 패키지의 몫이고,
 * 여기서는 `Select` 하나로 같은 계약을 보인다:
 *  - 처음 값: ① 이 스레드에서 쓴 id ② `remembered`(기기 기억 흉내) — 댓글을 받는 중(`threadLoading`)이 아니고 내 프로필 목록에 있는 id 일 때만.
 *  - 기억(②)에서 스스로 채운 값만 스레드가 나중에 다른 프로필을 알려 오면 그쪽으로 다시 정한다. 스레드(①)가 정한 값 · 사람이 고른 값은 건드리지 않는다.
 *  - 이 스레드의 프로필과 다른 것으로 바꿀 때는 한 줄 확인(`data-author-notice`)을 띄우고 폼에 알린다(`onUnsettledChange`) — 답하기 전에는 제출이 막힌다.
 */
export function DemoPicker({
  value,
  onChange,
  threadAuthorId,
  threadLoading,
  invalid,
  disabled,
  onUnsettledChange,
  'aria-describedby': describedBy,
  profiles,
  label,
  placeholder,
  remembered,
}: AuthorPickerArgs & {
  profiles: readonly DemoProfile[]
  label: string
  placeholder: string
  remembered?: string
}) {
  const [asked, setAsked] = useState<string>()
  const auto = useRef<{ id: string; source: 'thread' | 'memory' }>(undefined)
  const alive = (id: string | undefined) =>
    id !== undefined && profiles.some((profile) => profile.id === id) ? id : undefined

  useEffect(() => {
    if (threadLoading) return // 「쓴 적 없음」 과 「아직 모름」 은 다르다
    if (value === undefined) {
      const fromThread = alive(threadAuthorId)
      const initial = fromThread ?? alive(remembered)
      if (initial !== undefined) {
        auto.current = { id: initial, source: fromThread !== undefined ? 'thread' : 'memory' }
        onChange(initial)
      }
      return
    }
    // 기억(②)에서 온 자동 값만 스레드가 나중에 알려 오면 다시 정한다 — 스레드(①)가 정한 값 · 사람이 고른 값은 그대로
    const thread = alive(threadAuthorId)
    if (
      auto.current?.id === value &&
      auto.current.source === 'memory' &&
      thread !== undefined &&
      thread !== value
    ) {
      auto.current = { id: thread, source: 'thread' }
      onChange(thread)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- alive 는 profiles 만 읽는다
  }, [value, threadAuthorId, threadLoading, profiles, remembered, onChange])

  const unsettled = asked !== undefined
  useEffect(() => {
    onUnsettledChange(unsettled)
  }, [unsettled, onUnsettledChange])

  const choose = (id: string | undefined) => {
    const thread = alive(threadAuthorId)
    if (id !== undefined && thread !== undefined && id !== thread && id !== value) setAsked(id)
    else {
      auto.current = undefined
      onChange(id)
    }
  }
  const nameOf = (id: string | undefined) => profiles.find((profile) => profile.id === id)?.name

  return (
    <>
      <Select
        aria-label={label}
        aria-describedby={describedBy}
        value={value ?? ''}
        invalid={invalid}
        disabled={disabled}
        onChange={(event) => choose(event.target.value || undefined)}
      >
        <option value="">{placeholder}</option>
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name}
          </option>
        ))}
      </Select>
      {asked !== undefined && (
        <span data-author-notice="">
          <span role="status">{`You wrote in this thread as ${nameOf(threadAuthorId)}.`}</span>
          <Button
            size="sm"
            onClick={() => {
              auto.current = undefined
              onChange(asked)
              setAsked(undefined)
            }}
          >{`Use ${nameOf(asked)}`}</Button>
          <Button size="sm" variant="secondary" onClick={() => setAsked(undefined)}>
            {`Keep ${nameOf(value) ?? 'current'}`}
          </Button>
        </span>
      )}
    </>
  )
}
