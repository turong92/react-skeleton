import { useAuth } from '@skeleton/auth'
import {
  AuthorPicker,
  browserLocalStorage,
  createAuthorMemory,
  type AuthorPickerSlotProps,
} from '@skeleton/author-profile'
import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../i18n'
import { profileApi } from './api'
import { authorProfileLabels } from './profileLabels'

/**
 * 게시판 `authorPicker` 에 꽂을 렌더 함수 — 글쓰기 · 댓글이 같은 것을 쓴다.
 * 기기 기억의 키에만 계정 id 가 들어가고(화면 · aria 에는 없다) 계정이 바뀌면 키가 달라진다. 프로필이 없을 때의 「프로필 만들기」는 설정 화면의 프로필 구역으로 보낸다.
 */
export function useAuthorPicker(boardCode: string): (args: AuthorPickerSlotProps) => ReactNode {
  const { t } = useT()
  const { principal } = useAuth()
  const navigate = useNavigate()
  const accountId = principal?.accountId
  const memory = useMemo(
    () => (accountId ? createAuthorMemory(browserLocalStorage(), accountId) : undefined),
    [accountId],
  )
  const labels = authorProfileLabels(t)
  return (args) => (
    <AuthorPicker
      {...args}
      api={profileApi}
      boardCode={boardCode}
      memory={memory}
      labels={labels}
      onCreateProfile={() => navigate('/settings#profiles')}
    />
  )
}
