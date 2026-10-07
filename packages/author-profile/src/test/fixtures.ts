import type { AuthorProfileApi } from '../authorProfileApi'
import type { AuthorProfile } from '../types'

/* 테스트가 함께 쓰는 도우미(공개 표면 아님). 스토리용 가짜 서버는 stories/fakeAuthorProfiles.ts */
export const at = '2026-01-01T00:00:00Z'

export const profile = (
  id: string,
  name: string | null,
  tag: string | null = '0001',
): AuthorProfile => ({
  id,
  name,
  tag,
  createdAt: at,
})

export function stubApi(over: Partial<AuthorProfileApi> = {}): AuthorProfileApi {
  const unused = async (): Promise<never> => {
    throw new Error('unused in this test')
  }
  return {
    getConfig: unused,
    list: unused,
    create: unused,
    rename: unused,
    remove: unused,
    ...over,
  }
}
