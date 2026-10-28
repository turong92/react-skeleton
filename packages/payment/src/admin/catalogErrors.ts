import { ErrorCodes, isErrorCode } from '@skeleton/api-client'

/** 운영 카탈로그 호출이 거절된 이유 - 폼이 제자리에서 말한다. 알려진 코드가 아니면 `null`(일반 문구 + 참조 번호) */
export type CatalogProblem =
  | 'codeTaken'
  | 'levelTaken'
  | 'priceOverlap'
  | 'priceInvalid'
  | 'notFound'

const CODES: ReadonlyArray<readonly [CatalogProblem, string]> = [
  ['codeTaken', ErrorCodes.CATALOG_CODE_TAKEN],
  ['levelTaken', ErrorCodes.CATALOG_LEVEL_TAKEN],
  ['priceOverlap', ErrorCodes.CATALOG_PRICE_OVERLAP],
  ['priceInvalid', ErrorCodes.CATALOG_PRICE_INVALID],
  ['notFound', ErrorCodes.CATALOG_NOT_FOUND],
]

export function catalogProblemOf(error: unknown): CatalogProblem | null {
  return CODES.find(([, code]) => isErrorCode(error, code))?.[0] ?? null
}
