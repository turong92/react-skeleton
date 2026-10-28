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

/** `texts.<언어>.…` 의 언어 태그를 정규화한다(`pt-br` → `pt-BR`) - 서버는 정규화한 태그로 칸 이름을 보낸다. 다른 칸은 그대로 */
function canonicalField(field: string): string {
  const match = /^texts\.([^.]+)(\..*)?$/.exec(field)
  if (!match) return field
  try {
    return `texts.${Intl.getCanonicalLocales(match[1]!)[0] ?? match[1]}${match[2] ?? ''}`
  } catch {
    return field
  }
}

/**
 * 입력 오류가 실어 온 칸별 메시지 - 상품은 `COMMON.VALIDATION_FAILED`, 가격은 `CATALOG.PRICE_INVALID`(둘 다 `errors[{ field, code, message }]`).
 * 칸 이름은 요청 본문의 이름 그대로다: 상품 `code` · `kind` · `level` · `texts` · `texts.<언어>.name` · `texts.<언어>.description`,
 * 가격 `code` · `period` · `amount` · `currency` · `compareAtAmount` · `saleEndsAt`, 결제사 링크 `externalId`.
 * 안쪽 칸(`texts.ko.name`)은 정확한 이름으로도, 뿌리(`texts`)로도 찾는다. 서버가 메시지를 안 주면 칸의 오류 코드를 그대로 쓴다
 */
export function fieldMessageOf(
  error: unknown,
  field: string,
  /** true 면 그 이름 그대로인 칸만(안쪽 칸으로 내려가지 않는다) */
  exact = false,
): string | undefined {
  const problem = catalogProblemOf(error)
  if (
    !(error instanceof ApiRequestError) ||
    (problem !== 'invalidInput' && problem !== 'priceInvalid')
  )
    return undefined
  const wanted = canonicalField(field)
  const hit = error.apiError.errors?.find((e) => {
    const got = canonicalField(e.field)
    return got === wanted || (!exact && got.startsWith(`${wanted}.`))
  })
  return hit ? (hit.message ?? hit.code) : undefined
}
