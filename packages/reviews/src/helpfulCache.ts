import type { ApiPageResponse } from '@skeleton/api-client'
import type { HelpfulState, Review } from './types'

/** 도움돼요 응답(서버가 센 값)을 캐시된 목록 쪽에 꽂는다. 그 쪽에 없으면 같은 객체를 돌려준다 */
export function patchHelpful(
  page: ApiPageResponse<Review> | undefined,
  id: string,
  state: HelpfulState,
): ApiPageResponse<Review> | undefined {
  if (!page || !page.values.some((review) => review.id === id)) return page
  return {
    ...page,
    values: page.values.map((review) => (review.id === id ? { ...review, ...state } : review)),
  }
}
