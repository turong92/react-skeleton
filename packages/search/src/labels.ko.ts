import type { SearchLabels } from './labels'

export const koSearchLabels: SearchLabels = {
  box: { label: '검색', placeholder: '검색', submit: '검색' },
  results: {
    tooShort: '2글자 이상 입력해 주세요.',
    loading: '검색하는 중',
    loadFailed: '검색하지 못했어요. 다시 시도해 주세요.',
    retry: '다시 시도',
    count: (total, capped) =>
      capped ? '결과 1,000개 이상' : `결과 ${total.toLocaleString('ko-KR')}개`,
    emptyTitle: (query) => `「${query}」에 맞는 결과가 없어요`,
    emptyBody: '맞춤법을 확인하거나 다른 단어로 찾아 보세요.',
    typeFilter: '결과 종류',
    allTypes: '전체',
    pagination: '검색 결과 쪽 이동',
    previous: '이전 쪽',
    next: '다음 쪽',
    page: (page) => `${page}쪽`,
  },
}
