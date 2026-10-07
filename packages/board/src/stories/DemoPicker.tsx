import { Select } from '@skeleton/ui'
import { useEffect } from 'react'
import type { AuthorPickerArgs } from '../authorship'
import type { DemoProfile } from './demoAuthorPicker'

/*
 * 스토리 · 시험용 작성자 선택기 — 보드는 선택기가 무엇인지 모른다(`authorPicker` 는 렌더 함수 하나). 진짜 선택기는 작성자 프로필 패키지의 몫이고,
 * 여기서는 `Select` 하나로 같은 계약(값 · 바꾸기 · 이 스레드에서 쓴 id · 오류 표시)을 보인다. 처음 값은 이 스레드에서 쓴 id.
 */

export function DemoPicker({
  value,
  onChange,
  threadAuthorId,
  invalid,
  disabled,
  profiles,
  label,
  placeholder,
}: AuthorPickerArgs & { profiles: readonly DemoProfile[]; label: string; placeholder: string }) {
  useEffect(() => {
    if (value === undefined && threadAuthorId !== undefined) onChange(threadAuthorId)
  }, [value, threadAuthorId, onChange])
  return (
    <Select
      aria-label={label}
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
