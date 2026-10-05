import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import { StorageValidationError, UploadHttpError } from '@skeleton/storage'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { uploadErrorMessage } from './uploadMessage'

const rejected = (codes: string[]) =>
  new ApiRequestError(
    {
      code: ErrorCodes.STORAGE_FILE_REJECTED,
      title: 'rejected',
      status: 400,
      timestamp: 't',
      data: { errors: codes.map((code) => ({ code, message: code })) },
    },
    'a',
    'b',
    'c',
  )

describe('uploadErrorMessage — which sentence the user reads', () => {
  it('too large, from the browser rule or from the server rejection', () => {
    expect(
      uploadErrorMessage(new StorageValidationError([{ code: 'SIZE_TOO_LARGE', message: '' }])),
    ).toBe(i18n.t('attachment.tooLarge'))
    expect(uploadErrorMessage(rejected(['SIZE_TOO_LARGE']))).toBe(i18n.t('attachment.tooLarge'))
  })

  it('unsupported type or extension', () => {
    expect(uploadErrorMessage(rejected(['UNSUPPORTED_CONTENT_TYPE']))).toBe(
      i18n.t('attachment.unsupported'),
    )
    expect(
      uploadErrorMessage(
        new StorageValidationError([{ code: 'UNSUPPORTED_EXTENSION', message: '' }]),
      ),
    ).toBe(i18n.t('attachment.unsupported'))
  })

  it('anything else (storage 403, network) is the generic failure; no error is no message', () => {
    expect(uploadErrorMessage(new UploadHttpError(403))).toBe(i18n.t('attachment.failed'))
    expect(uploadErrorMessage(new Error('x'))).toBe(i18n.t('attachment.failed'))
    expect(uploadErrorMessage(null)).toBeUndefined()
  })
})

describe('uploadErrorMessage — in the chosen language', () => {
  afterEach(() => i18n.setLocale('ko', { remember: false }))

  it('reads in English once the language is English (the sentence is chosen when the error is shown)', async () => {
    await i18n.setLocale('en', { remember: false })
    expect(uploadErrorMessage(rejected(['SIZE_TOO_LARGE']))).toBe(
      'That file is too large. Files up to 5 MB can be uploaded.',
    )
  })
})
