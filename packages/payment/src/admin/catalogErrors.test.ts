import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { catalogProblemOf, fieldMessageOf } from './catalogErrors'

const failed = (code: string, status: number) =>
  new ApiRequestError({ code, title: 't', status, timestamp: 't', traceId: 'tr' }, 'tr', 'sp', 'tp')

describe('catalogProblemOf', () => {
  it('names the five catalog rejections', () => {
    expect(catalogProblemOf(failed('CATALOG.CODE_TAKEN', 409))).toBe('codeTaken')
    expect(catalogProblemOf(failed('CATALOG.LEVEL_TAKEN', 409))).toBe('levelTaken')
    expect(catalogProblemOf(failed('CATALOG.PRICE_OVERLAP', 409))).toBe('priceOverlap')
    expect(catalogProblemOf(failed('CATALOG.PRICE_INVALID', 400))).toBe('priceInvalid')
    expect(catalogProblemOf(failed('CATALOG.NOT_FOUND', 404))).toBe('notFound')
  })

  it('anything else is unknown, not guessed', () => {
    expect(catalogProblemOf(failed('COMMON.INTERNAL_SERVER_ERROR', 500))).toBeNull()
    expect(catalogProblemOf(new Error('boom'))).toBeNull()
    expect(catalogProblemOf(undefined)).toBeNull()
  })
})

describe('input errors', () => {
  const invalid = new ApiRequestError(
    {
      code: 'COMMON.PARAMETER_VALIDATION_FAILED',
      title: 't',
      status: 400,
      timestamp: 't',
      errors: [
        { field: 'code', code: 'PATTERN', message: 'must match' },
        { field: 'texts[ko].name', code: 'NOT_BLANK' },
      ],
    },
    'tr',
    'sp',
    'tp',
  )

  it('is named, and each field finds its own message (inner fields by their root; no message → the code)', () => {
    expect(catalogProblemOf(invalid)).toBe('invalidInput')
    expect(fieldMessageOf(invalid, 'code')).toBe('must match')
    expect(fieldMessageOf(invalid, 'texts')).toBe('NOT_BLANK')
    expect(fieldMessageOf(invalid, 'level')).toBeUndefined()
    expect(fieldMessageOf(new Error('x'), 'code')).toBeUndefined()
  })
})
