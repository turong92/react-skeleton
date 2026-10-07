import { Button } from '@skeleton/ui'
import { useState } from 'react'
import { AuthorPicker } from '../AuthorPicker'
import { createAuthorMemory, type StorageLike } from '../authorMemory'
import type { AuthorProfileApi } from '../authorProfileApi'
import { WithQuery } from './WithQuery'

const noop = () => undefined

/**
 * 게시판 폼 흉내 — 값을 쥐고 `authorPicker` 자리에 선택기를 꽂고, 옆에 제출 단추를 둔다(실제로는 `@skeleton/board` 의 폼이 `authorPicker` 렌더 prop 으로 부른다:
 * `authorPicker={(args) => <AuthorPicker {...args} api={api} boardCode={code} memory={memory} />}`).
 */
export function PickerDemo({
  api,
  boardCode = 'free',
  threadAuthorId,
  threadLoading = false,
  describedBy,
  remembered,
  storage,
  invalid = false,
  disabled = false,
  onChange,
  onUnsettledChange,
  onCreateProfile,
  onSend,
}: {
  api: AuthorProfileApi
  boardCode?: string
  threadAuthorId?: string
  /** 댓글을 아직 받는 중(처음 값을 확정하지 않는다) */
  threadLoading?: boolean
  /** 칸 오류 문장의 id */
  describedBy?: string
  /** 이 기기가 이 게시판에서 기억하는 프로필 id(처음 값 ②) */
  remembered?: string
  storage: StorageLike
  invalid?: boolean
  disabled?: boolean
  onChange?: (authorId: string | undefined) => void
  /** 한 줄 확인이 떠 있는지의 알림(폼이 제출을 막는 근거) */
  onUnsettledChange?: (unsettled: boolean) => void
  onCreateProfile?: () => void
  /** 「Send」 를 눌렀다(폼 제출) */
  onSend?: () => void
}) {
  const [value, setValue] = useState<string>()
  const [memory] = useState(() => {
    const made = createAuthorMemory(storage, 'acc_story_only_in_the_storage_key')
    if (remembered) made.set(boardCode, remembered)
    return made
  })
  return (
    <WithQuery>
      <form
        aria-label="Post"
        onSubmit={(event) => {
          event.preventDefault()
          onSend?.()
        }}
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
          threadLoading={threadLoading}
          aria-describedby={describedBy}
          invalid={invalid}
          disabled={disabled}
          onUnsettledChange={onUnsettledChange ?? noop}
          onCreateProfile={onCreateProfile}
        />
        <Button type="submit">Send</Button>
        {describedBy && <p id={describedBy}>Choose who to post as.</p>}
      </form>
      <Button variant="ghost">Elsewhere</Button>
    </WithQuery>
  )
}
