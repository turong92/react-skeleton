import { describe, expect, it } from 'vitest'
import { apiError, fieldError } from '../test/apiFixtures'
import { koAuthLabels as L } from './labels.ko'
import { loginIdSubmitOutcome } from './loginIdRequiredOutcome'

/* 설계 §13.1 - 409 LOGIN_ID_TAKEN 은 칸 옆 오류, 409 LOGIN_ID_ALREADY_SET 은 다른 탭에서 정한 것(me 를 다시 읽고 접는다) */
const rules = { minLength: 4, maxLength: 20 }
const at = (error: unknown) => loginIdSubmitOutcome(error, { value: 'sumin', rules, labels: L })

describe('loginIdSubmitOutcome', () => {
  it('LOGIN_ID_TAKEN is a field error beside the input, in our words', () => {
    expect(at(apiError('ACCOUNT.LOGIN_ID_TAKEN', 409))).toEqual({
      kind: 'field',
      message: L.errorLoginIdTaken,
    })
  })

  it('a loginId field error from the server is a field error too', () => {
    expect(at(fieldError('loginId', 'Size', 'English from the server'))).toEqual({
      kind: 'field',
      message: L.problemLoginIdSize(4, 20),
    })
  })

  it('LOGIN_ID_ALREADY_SET means another tab already chose one', () => {
    expect(at(apiError('ACCOUNT.LOGIN_ID_ALREADY_SET', 409))).toEqual({ kind: 'already-set' })
  })

  it('everything else (429, 403 NOT_ACTIVE, network) is left to the screen’s error line', () => {
    expect(at(apiError('ACCOUNT.RATE_LIMITED', 429))).toEqual({ kind: 'other' })
    expect(at(new Error('network'))).toEqual({ kind: 'other' })
  })
})
