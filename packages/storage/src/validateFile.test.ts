import { describe, expect, it } from 'vitest'
import { validateFile } from './validateFile'

const file = (name: string, size: number, type = '') =>
  new File([new Uint8Array(size)], name, { type })

/* 규칙 의미는 백엔드 `StorageFileValidator`(modules/storage)와 같다 — 같은 코드 이름 */
describe('validateFile (mirrors kotlin-skeleton StorageFileValidator)', () => {
  it('no rules → valid', () => {
    expect(validateFile(file('a.bin', 10), {})).toEqual([])
  })

  it('size over maxSizeBytes → SIZE_TOO_LARGE (equal is fine)', () => {
    expect(
      validateFile(file('a.png', 11, 'image/png'), { maxSizeBytes: 10 }).map((e) => e.code),
    ).toEqual(['SIZE_TOO_LARGE'])
    expect(validateFile(file('a.png', 10, 'image/png'), { maxSizeBytes: 10 })).toEqual([])
  })

  it('content type: exact or "type/*" wildcard, case-insensitive; a blank type is not allowed once a list is set', () => {
    const rules = { allowedContentTypes: ['image/*', 'application/pdf'] }
    expect(validateFile(file('a.png', 1, 'IMAGE/PNG'), rules)).toEqual([])
    expect(validateFile(file('a.pdf', 1, 'application/pdf'), rules)).toEqual([])
    expect(validateFile(file('a.txt', 1, 'text/plain'), rules).map((e) => e.code)).toEqual([
      'UNSUPPORTED_CONTENT_TYPE',
    ])
    expect(validateFile(file('a.png', 1, ''), rules).map((e) => e.code)).toEqual([
      'UNSUPPORTED_CONTENT_TYPE',
    ])
  })

  it('extension: leading dot and case do not matter; a name without an extension fails', () => {
    const rules = { allowedExtensions: ['.PNG', 'jpg'] }
    expect(validateFile(file('x.png', 1), rules)).toEqual([])
    expect(validateFile(file('x.JPG', 1), rules)).toEqual([])
    expect(validateFile(file('x.gif', 1), rules).map((e) => e.code)).toEqual([
      'UNSUPPORTED_EXTENSION',
    ])
    expect(validateFile(file('png', 1), rules).map((e) => e.code)).toEqual([
      'UNSUPPORTED_EXTENSION',
    ])
  })

  it('reports every violated rule, each with a message', () => {
    const errors = validateFile(file('x.gif', 99, 'image/gif'), {
      maxSizeBytes: 10,
      allowedContentTypes: ['image/png'],
      allowedExtensions: ['png'],
    })
    expect(errors.map((e) => e.code)).toEqual([
      'SIZE_TOO_LARGE',
      'UNSUPPORTED_CONTENT_TYPE',
      'UNSUPPORTED_EXTENSION',
    ])
    for (const error of errors) expect(error.message.length).toBeGreaterThan(0)
  })
})
