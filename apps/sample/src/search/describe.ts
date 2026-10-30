import type { SearchTypeInfo } from '@skeleton/search'
import type { MessageKey } from '../i18n'

/** 검색에 색인되는 종류(백엔드: 노트는 `NoteService`, 상품은 `catalog`) - 칩의 순서 */
export const SEARCH_TYPES = ['note', 'product'] as const

/** 결과 종류마다 이름과 링크 - 노트는 `/notes/:id`, 상품은 `/products/:code` */
export function describeSearchType(t: (key: MessageKey) => string, type: string): SearchTypeInfo {
  return type === 'product'
    ? { label: t('search.type.product'), href: (id) => `/products/${encodeURIComponent(id)}` }
    : { label: t('search.type.note'), href: (id) => `/notes/${encodeURIComponent(id)}` }
}
