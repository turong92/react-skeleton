import { describe, expect, it } from 'vitest'
import { apiError, fieldError } from '../test/apiFixtures'
import { koAuthLabels as L } from './labels.ko'
import { loginIdServerError } from './loginIdServerError'

/* 설계 §13.1 - 서버의 409 · 필드 오류(errors[].field=loginId)는 칸 옆 오류로. 서버의 영어 message 는 보이지 않는다 */
const rules = { minLength: 4, maxLength: 20 }
const at = (error: unknown, value = 'sumin') =>
  loginIdServerError(error, { value, rules, labels: L })

describe('loginIdServerError', () => {
  it('409 ACCOUNT.LOGIN_ID_TAKEN is the "taken" sentence', () => {
    expect(at(apiError('ACCOUNT.LOGIN_ID_TAKEN', 409))).toBe(L.errorLoginIdTaken)
  })

  it('a loginId field error becomes our sentence, by its code', () => {
    expect(at(fieldError('loginId', 'Required', 'English from the server'))).toBe(
      L.problemLoginIdMissing,
    )
    expect(at(fieldError('loginId', 'Size', 'English from the server'))).toBe(
      L.problemLoginIdSize(4, 20),
    )
  })

  it('a Pattern error names what the client rules find wrong with the value that was sent', () => {
    const pattern = fieldError('loginId', 'Pattern', 'English from the server')
    expect(at(pattern, 'a b c d')).toBe(L.problemLoginIdChars)
    expect(at(pattern, '.sumin')).toBe(L.problemLoginIdSymbols)
    expect(at(pattern, '123456')).toBe(L.problemLoginIdDigitsOnly)
    // 클라이언트 규칙으로는 문제를 못 찾아도(서버가 더 엄격) 서버가 거절했다는 사실은 말한다
    expect(at(pattern, 'sumin')).toBe(L.problemLoginIdChars)
  })

  it('anything else is not a login id error', () => {
    expect(at(apiError('ACCOUNT.EMAIL_TAKEN', 409))).toBeUndefined()
    expect(at(fieldError('email', 'Pattern', 'x'))).toBeUndefined()
    expect(at(new Error('network'))).toBeUndefined()
  })
})
