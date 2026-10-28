import { ApiRequestError, ErrorCodes, isErrorCode } from '@skeleton/api-client'

/** 운영 카탈로그 호출이 거절된 이유 - 폼이 제자리에서 말한다. 알려진 코드가 아니면 `null`(일반 문구 + 참조 번호) */
export type CatalogProblem =
  | 'codeTaken'
  | 'levelTaken'
  | 'priceOverlap'
  | 'priceInvalid'
  | 'notFound'
  | 'invalidInput'

const CODES: ReadonlyArray<readonly [CatalogProblem, string]> = [
  ['codeTaken', ErrorCodes.CATALOG_CODE_TAKEN],
  ['levelTaken', ErrorCodes.CATALOG_LEVEL_TAKEN],
  ['priceOverlap', ErrorCodes.CATALOG_PRICE_OVERLAP],
  ['priceInvalid', ErrorCodes.CATALOG_PRICE_INVALID],
  ['notFound', ErrorCodes.CATALOG_NOT_FOUND],
  ['invalidInput', ErrorCodes.COMMON_PARAMETER_VALIDATION_FAILED],
  ['invalidInput', ErrorCodes.COMMON_VALIDATION_FAILED],
]

export function catalogProblemOf(error: unknown): CatalogProblem | null {
  return CODES.find(([, code]) => isErrorCode(error, code))?.[0] ?? null
}

/**
 * 입력 오류(400 `COMMON.PARAMETER_VALIDATION_FAILED`)가 실어 온 칸별 메시지 - 칸 이름(`code` · `level` …)으로 찾는다.
 * `texts[ko].name` 처럼 안쪽 칸은 `texts` 로 찾는다. 서버가 메시지를 안 주면 칸의 오류 코드를 그대로 쓴다
 */
export function fieldMessageOf(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiRequestError) || catalogProblemOf(error) !== 'invalidInput')
    return undefined
  const hit = error.apiError.errors?.find(
    (e) => e.field === field || e.field.startsWith(`${field}.`) || e.field.startsWith(`${field}[`),
  )
  return hit ? (hit.message ?? hit.code) : undefined
}
