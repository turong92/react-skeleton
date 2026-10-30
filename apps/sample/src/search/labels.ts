import {
  defaultSearchLabels,
  koSearchLabels,
  resolveSearchLabels,
  type SearchLabels,
} from '@skeleton/search'

/*
 * 검색 화면의 문구 - 패키지 사전을 언어에 맞게 고르되 머리말 검색창의 이름만 바꾼다.
 * 노트 화면에도 「검색」 / "Search" 라는 이름의 검색칸이 있어(노트 목록 거르기), 머리말 검색창이 같은 이름이면
 * 한 화면에 이름이 같은 검색칸 두 개가 생긴다(낭독 · 시험이 가려내지 못한다). 이름에 그 낱말을 넣지 않는다.
 */
const koBox = { label: '전체 찾기', placeholder: '전체 찾기', submit: '찾기' }
const enBox = { label: 'Find anything', placeholder: 'Find anything', submit: 'Find' }

export const searchLabelsFor = (language: 'ko' | 'en'): SearchLabels =>
  resolveSearchLabels({
    ...(language === 'ko' ? koSearchLabels : defaultSearchLabels),
    box: language === 'ko' ? koBox : enBox,
  })
