import { defaultSearchLabels } from './labels.en'

export type SearchLabels = {
  box: {
    /** 검색 입력의 이름 · 묶음(`role="search"`)의 이름 */
    label: string
    placeholder: string
    submit: string
  }
  results: {
    /** 2글자 미만 안내 */
    tooShort: string
    loading: string
    loadFailed: string
    retry: string
    /** 「결과 12개」 - 서버는 1,000 번째에서 세기를 멈춘다(`capped`) */
    count: (total: number, capped: boolean) => string
    emptyTitle: (query: string) => string
    emptyBody: string
    /** 종류 칩 묶음의 이름 */
    typeFilter: string
    allTypes: string
    pagination: string
    previous: string
    next: string
    page: (page: number) => string
  }
}

/** 일부만 바꾸는 입력 */
export type SearchLabelsInput = { [K in keyof SearchLabels]?: Partial<SearchLabels[K]> }

export { defaultSearchLabels } from './labels.en'
export { koSearchLabels } from './labels.ko'

export function resolveSearchLabels(input: SearchLabelsInput = {}): SearchLabels {
  return {
    box: { ...defaultSearchLabels.box, ...input.box },
    results: { ...defaultSearchLabels.results, ...input.results },
  }
}
