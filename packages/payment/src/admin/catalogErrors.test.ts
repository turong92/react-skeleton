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

describe('input errors (the real backend shape)', () => {
  const invalid = new ApiRequestError(
    {
      code: 'COMMON.VALIDATION_FAILED',
      title: 't',
      status: 400,
      timestamp: 't',
      errors: [
        { field: 'code', code: 'Pattern', message: 'must match' },
        { field: 'texts.ko.name', code: 'Required' },
      ],
    },
    'tr',
    'sp',
    'tp',
  )

  it('is named, and each field finds its own message (inner fields by their root; no message → the code)', () => {
    expect(catalogProblemOf(invalid)).toBe('invalidInput')
    expect(fieldMessageOf(invalid, 'code')).toBe('must match')
    expect(fieldMessageOf(invalid, 'texts')).toBe('Required')
    expect(fieldMessageOf(invalid, 'texts', true)).toBeUndefined()
    expect(fieldMessageOf(invalid, 'texts.ko.name')).toBe('Required')
    expect(fieldMessageOf(invalid, 'texts.en.name')).toBeUndefined()
    expect(fieldMessageOf(invalid, 'level')).toBeUndefined()
    expect(fieldMessageOf(new Error('x'), 'code')).toBeUndefined()
  })

  it('a price rejection carries its fields too; a state rejection has none', () => {
    const price = new ApiRequestError(
      {
        code: 'CATALOG.PRICE_INVALID',
        title: 't',
        status: 400,
        timestamp: 't',
        errors: [{ field: 'saleEndsAt', code: 'Invalid', message: 'must be after the start' }],
      },
      'tr',
      'sp',
      'tp',
    )
    expect(catalogProblemOf(price)).toBe('priceInvalid')
    expect(fieldMessageOf(price, 'saleEndsAt')).toBe('must be after the start')
    const state = new ApiRequestError(
      {
        code: 'CATALOG.PRICE_INVALID',
        title: 't',
        status: 400,
        detail: 'price is stopped',
        timestamp: 't',
      },
      'tr',
      'sp',
      'tp',
    )
    expect(fieldMessageOf(state, 'amount')).toBeUndefined()
  })

  it('compares language tags in their canonical form (the server sends texts.pt-BR.name for a pt-br field)', () => {
    const error = new ApiRequestError(
      {
        code: 'COMMON.VALIDATION_FAILED',
        title: 't',
        status: 400,
        timestamp: 't',
        errors: [{ field: 'texts.pt-BR.name', code: 'Required', message: 'name needed' }],
      },
      'tr',
      'sp',
      'tp',
    )
    expect(fieldMessageOf(error, 'texts.pt-br.name')).toBe('name needed')
    expect(fieldMessageOf(error, 'texts.PT-br.name')).toBe('name needed')
    expect(fieldMessageOf(error, 'texts.pt.name')).toBeUndefined()
  })
})
