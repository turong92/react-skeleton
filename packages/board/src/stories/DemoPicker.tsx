import { Select } from '@skeleton/ui'
import { useEffect } from 'react'
import type { AuthorPickerArgs } from '../authorship'
import type { DemoProfile } from './demoAuthorPicker'

/*
 * 스토리 · 시험용 작성자 선택기 — 보드는 선택기가 무엇인지 모른다(`authorPicker` 는 렌더 함수 하나). 진짜 선택기는 작성자 프로필 패키지의 몫이고,
 * 여기서는 `Select` 하나로 같은 계약(값 · 바꾸기 · 이 스레드에서 쓴 id · 오류 표시)을 보인다. 처음 값은 이 스레드에서 쓴 id — 단 댓글을 받는 중(`threadLoading`)이 아니고, 내 프로필 목록에 있는 id 일 때만.
 */

export function DemoPicker({
  value,
  onChange,
  threadAuthorId,
  threadLoading,
  invalid,
  disabled,
  'aria-describedby': describedBy,
  profiles,
  label,
  placeholder,
}: AuthorPickerArgs & { profiles: readonly DemoProfile[]; label: string; placeholder: string }) {
  useEffect(() => {
    // 댓글을 받는 중에는 확정하지 않는다(undefined 가 「쓴 적 없음」이 아니다) · 내 프로필 목록에 있는 id 일 때만 채택한다
    if (threadLoading || value !== undefined || threadAuthorId === undefined) return
    if (profiles.some((profile) => profile.id === threadAuthorId)) onChange(threadAuthorId)
  }, [value, threadAuthorId, threadLoading, profiles, onChange])
  return (
    <Select
      aria-label={label}
      aria-describedby={describedBy}
      value={value ?? ''}
      invalid={invalid}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value || undefined)}
    >
      <option value="">{placeholder}</option>
      {profiles.map((profile) => (
        <option key={profile.id} value={profile.id}>
          {profile.name}
        </option>
      ))}
    </Select>
  )
}
