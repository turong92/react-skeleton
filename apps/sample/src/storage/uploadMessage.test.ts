import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import { StorageValidationError, UploadHttpError } from '@skeleton/storage'
import { describe, expect, it } from 'vitest'
import { strings } from '../strings'
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
    ).toBe(strings.attachment.tooLarge)
    expect(uploadErrorMessage(rejected(['SIZE_TOO_LARGE']))).toBe(strings.attachment.tooLarge)
  })

  it('unsupported type or extension', () => {
    expect(uploadErrorMessage(rejected(['UNSUPPORTED_CONTENT_TYPE']))).toBe(
      strings.attachment.unsupported,
    )
    expect(
      uploadErrorMessage(
        new StorageValidationError([{ code: 'UNSUPPORTED_EXTENSION', message: '' }]),
      ),
    ).toBe(strings.attachment.unsupported)
  })

  it('anything else (storage 403, network) is the generic failure; no error is no message', () => {
    expect(uploadErrorMessage(new UploadHttpError(403))).toBe(strings.attachment.failed)
    expect(uploadErrorMessage(new Error('x'))).toBe(strings.attachment.failed)
    expect(uploadErrorMessage(null)).toBeUndefined()
  })
})
