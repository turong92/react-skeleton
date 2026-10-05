import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { fieldErrorsOf, isValidationFailure } from './formErrors'

const validation = (errors: Array<{ field: string; code: string; message?: string }>) =>
  new ApiRequestError(
    {
      code: ErrorCodes.COMMON_VALIDATION_FAILED,
      title: 'Validation failed',
      status: 400,
      timestamp: 't',
      errors,
    },
    'trace',
    'span',
    'tp',
  )

describe('fieldErrorsOf — the backend 400 mapped onto form fields', () => {
  it('maps each field error to a Korean message by its code', () => {
    const error = validation([
      { field: 'title', code: 'NotBlank', message: 'must not be blank' },
      { field: 'body', code: 'Size', message: 'size must be between 0 and 5000' },
    ])
    const errors = fieldErrorsOf(error)
    expect(errors.title).toMatch(/[가-힣]/)
    expect(errors.body).toMatch(/[가-힣]/)
    expect(errors.title).not.toContain('must not be blank')
  })

  it('keeps the first message per field and falls back to a generic Korean one for an unknown code', () => {
    const errors = fieldErrorsOf(
      validation([
        { field: 'title', code: 'NotBlank' },
        { field: 'title', code: 'Size' },
        { field: 'status', code: 'SomethingNew', message: 'weird' },
      ]),
    )
    expect(Object.keys(errors).sort()).toEqual(['status', 'title'])
    expect(errors.status).toMatch(/[가-힣]/)
  })

  it('is empty for anything that is not a validation failure', () => {
    expect(fieldErrorsOf(new Error('boom'))).toEqual({})
    expect(fieldErrorsOf(undefined)).toEqual({})
  })
})

describe('isValidationFailure', () => {
  it('is true only for COMMON.VALIDATION_FAILED', () => {
    expect(isValidationFailure(validation([]))).toBe(true)
    expect(isValidationFailure(new Error('x'))).toBe(false)
  })
})

describe('fieldErrorsOf — in the chosen language', () => {
  afterEach(() => i18n.setLocale('ko', { remember: false }))

  it('gives the English sentence once the language is English, with the generic one for an unknown code', async () => {
    await i18n.setLocale('en', { remember: false })
    const errors = fieldErrorsOf(
      validation([
        { field: 'title', code: 'NotBlank' },
        { field: 'status', code: 'SomethingNew' },
      ]),
    )
    expect(errors).toEqual({
      title: 'Please enter a value.',
      status: 'Please check this value.',
    })
  })
})
