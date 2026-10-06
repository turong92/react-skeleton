import type { LegalApi } from './legalApi'
import type { ReadDocumentOptions } from './types'

/** 쿼리 키 — 동의를 바꾸면 `consents` 를 무효화한다(문서는 안 바뀐다) */
export const legalKeys = {
  all: ['legal'] as const,
  documents: () => [...legalKeys.all, 'documents'] as const,
  document: (type: string, options: ReadDocumentOptions = {}) =>
    [
      ...legalKeys.all,
      'document',
      type,
      options.version ?? 'current',
      options.locale ?? '',
    ] as const,
  consents: () => [...legalKeys.all, 'consents'] as const,
  history: (page: number, size: number) =>
    [...legalKeys.consents(), 'history', page, size] as const,
}

export const documentsQuery = (api: LegalApi) => ({
  queryKey: legalKeys.documents(),
  queryFn: () => api.documents(),
})

export const documentQuery = (api: LegalApi, type: string, options: ReadDocumentOptions = {}) => ({
  queryKey: legalKeys.document(type, options),
  queryFn: () => api.document(type, options),
})

export const myConsentsQuery = (api: LegalApi) => ({
  queryKey: [...legalKeys.consents(), 'me'] as const,
  queryFn: () => api.myConsents(),
})

export const historyQuery = (api: LegalApi, page: number, size: number) => ({
  queryKey: legalKeys.history(page, size),
  queryFn: () => api.history({ page, size }),
})
