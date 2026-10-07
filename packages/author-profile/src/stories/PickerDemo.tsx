import { Button } from '@skeleton/ui'
import { useState } from 'react'
import { AuthorPicker } from '../AuthorPicker'
import { createAuthorMemory, type StorageLike } from '../authorMemory'
import type { AuthorProfileApi } from '../authorProfileApi'
import { WithQuery } from './WithQuery'

/**
 * 게시판 폼 흉내 — 값을 쥐고 `authorPicker` 자리에 선택기를 꽂고, 옆에 제출 단추를 둔다(실제로는 `@skeleton/board` 의 폼이 `authorPicker` 렌더 prop 으로 부른다:
 * `authorPicker={(args) => <AuthorPicker {...args} api={api} boardCode={code} memory={memory} />}`).
 */
export function PickerDemo({
  api,
  boardCode = 'free',
  threadAuthorId,
  remembered,
  storage,
  invalid = false,
  disabled = false,
  onChange,
  onCreateProfile,
}: {
  api: AuthorProfileApi
  boardCode?: string
  threadAuthorId?: string
  /** 이 기기가 이 게시판에서 기억하는 프로필 id(처음 값 ②) */
  remembered?: string
  storage: StorageLike
  invalid?: boolean
  disabled?: boolean
  onChange?: (authorId: string | undefined) => void
  onCreateProfile?: () => void
}) {
  const [value, setValue] = useState<string>()
  const [memory] = useState(() => {
    const made = createAuthorMemory(storage, 'acc_story_only_in_the_storage_key')
    if (remembered) made.set(boardCode, remembered)
    return made
  })
  return (
    <WithQuery>
      <div
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-sm)' }}
      >
        <AuthorPicker
          api={api}
          boardCode={boardCode}
          memory={memory}
          value={value}
          onChange={(next) => {
            setValue(next)
            onChange?.(next)
          }}
          threadAuthorId={threadAuthorId}
          invalid={invalid}
          disabled={disabled}
          onCreateProfile={onCreateProfile}
        />
        <Button>Send</Button>
      </div>
    </WithQuery>
  )
}
