import type { SearchLabels } from './labels'

/** 기본 문구(영어) */
export const defaultSearchLabels: SearchLabels = {
  box: { label: 'Search', placeholder: 'Search', submit: 'Search' },
  results: {
    tooShort: 'Type at least 2 characters.',
    loading: 'Searching',
    loadFailed: 'Could not search. Try again.',
    retry: 'Try again',
    count: (total, capped) =>
      capped
        ? 'Over 1,000 results'
        : total === 1
          ? '1 result'
          : `${total.toLocaleString('en-US')} results`,
    emptyTitle: (query) => `No results for "${query}"`,
    emptyBody: 'Check the spelling or try a different word.',
    typeFilter: 'Result types',
    allTypes: 'All',
    pagination: 'Search results pages',
    previous: 'Previous page',
    next: 'Next page',
    page: (page) => `Page ${page}`,
  },
}
