import { Button, Input } from '@skeleton/ui'
import { useState } from 'react'
import { AuthorPickerView } from '../AuthorPickerView'
import type { AuthorProfileApi } from '../authorProfileApi'
import { useAuthorProfiles } from '../hooks'
import { useProfileDialog } from '../useProfileDialog'
import { WithQuery } from './WithQuery'

function Slot({ api }: { api: AuthorProfileApi }) {
  const [value, setValue] = useState<string>()
  const list = useAuthorProfiles(api)
  const { open, dialog } = useProfileDialog({ api, title: 'Create a profile first' })
  return (
    <>
      <form aria-label="Post" onSubmit={(event) => event.preventDefault()}>
        <Input aria-label="Draft" />
        <div data-author-slot="">
          <AuthorPickerView
            profiles={list.data ?? []}
            boardCode="free"
            value={value}
            onChange={setValue}
            threadAuthorId={undefined}
            threadLoading={false}
            invalid={false}
            disabled={false}
            onCreateProfile={open}
          />
        </div>
        <Button type="submit">Post</Button>
      </form>
      {dialog /* 폼 밖에 — 대화상자 안의 폼이 글쓰기 폼에 중첩되지 않게 */}
    </>
  )
}

/**
 * 게시판 폼 흉내 — 프로필이 없으면 선택기 자리에 「프로필 만들기」가 있고, 누르면 대화상자가 열린다.
 * 만들고 닫으면 쓰던 글이 그대로이고, 사라진 단추 대신 선택기 자리의 새 조작 요소가 포커스를 받는다.
 */
export function CreateFlowDemo({ api }: { api: AuthorProfileApi }) {
  return (
    <WithQuery>
      <Slot api={api} />
    </WithQuery>
  )
}
