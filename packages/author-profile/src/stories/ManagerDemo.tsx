import { useState } from 'react'
import { AuthorProfileManager } from '../AuthorProfileManager'
import type { AuthorProfileApi } from '../authorProfileApi'
import { createFakeAuthorProfiles, type FakeAuthorProfilesOptions } from './fakeAuthorProfiles'
import { WithQuery } from './WithQuery'

/** 가짜 서버(또는 넘긴 `api`)에 `AuthorProfileManager` 를 이은 스토리용 화면 — 스토리를 열 때 한 번만 만든다 */
export function ManagerDemo({
  api,
  beforeRemove,
  ...options
}: FakeAuthorProfilesOptions & { api?: AuthorProfileApi; beforeRemove?: () => boolean }) {
  const [made] = useState(() => api ?? createFakeAuthorProfiles(options).api)
  return (
    <WithQuery>
      <AuthorProfileManager api={made} beforeRemove={beforeRemove} />
    </WithQuery>
  )
}
