import type { SearchTypeInfo } from '../types'

/** 스토리 · 시험용 - 앱이 주는 종류 이름과 링크(견본 앱은 노트 → `/notes/:id`, 상품 → `/products/:code`) */
export const describeDemo = (type: string): SearchTypeInfo =>
  type === 'product'
    ? { label: '상품', href: (id) => `/products/${id}` }
    : { label: '노트', href: (id) => `/notes/${id}` }
