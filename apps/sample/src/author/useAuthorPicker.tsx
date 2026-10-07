import { useAuth } from '@skeleton/auth'
import {
  AuthorPicker,
  AuthorPickerView,
  browserLocalStorage,
  createAuthorMemory,
  type AuthorPickerSlotProps,
} from '@skeleton/author-profile'
import { useMemo, type ReactNode } from 'react'
import { useT } from '../i18n'
import { profileApi } from './api'
import { authorProfileLabels } from './profileLabels'
import type { ProfileGate } from './useProfileGate'

/**
 * 게시판 `authorPicker` 에 꽂을 렌더 함수 — 글쓰기 · 댓글이 같은 것을 쓴다.
 * 기기 기억의 키에만 계정 id 가 들어가고(화면 · aria 에는 없다) 계정이 바뀌면 키가 달라진다.
 * 이름 있는 프로필이 없으면(`gate.mustCreate`) 목록 대신 「프로필 만들기」 단추만 보이고, 누르면 프로필 게이트 대화상자가 열린다(쓰던 글은 그대로) —
 * 그래서 새 글 · 새 댓글 · 답글은 폼이 막고, 댓글 수정에는 아무것도 걸리지 않는다
 */
export function useAuthorPicker(
  boardCode: string,
  gate: Pick<ProfileGate, 'mustCreate' | 'open'>,
): (args: AuthorPickerSlotProps) => ReactNode {
  const { t } = useT()
  const { principal } = useAuth()
  const accountId = principal?.accountId
  const memory = useMemo(
    () => (accountId ? createAuthorMemory(browserLocalStorage(), accountId) : undefined),
    [accountId],
  )
  const labels = authorProfileLabels(t)
  return (args) =>
    gate.mustCreate ? (
      <AuthorPickerView
        {...args}
        profiles={[]}
        boardCode={boardCode}
        labels={labels}
        onCreateProfile={gate.open}
        createOpensDialog
      />
    ) : (
      <AuthorPicker
        {...args}
        api={profileApi}
        boardCode={boardCode}
        memory={memory}
        labels={labels}
        onCreateProfile={gate.open}
        createOpensDialog
      />
    )
}
