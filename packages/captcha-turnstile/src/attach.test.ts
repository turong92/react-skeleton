import { describe, expect, it } from 'vitest'
import {
  attachTurnstileToken,
  TURNSTILE_RESPONSE_FIELD,
  TurnstileTokenMissingError,
  turnstileHeaders,
} from './attach'

/* 백엔드 TurnstileVerifier.verify(token) 가 받는 값은 위젯이 준 `cf-turnstile-response` 토큰이다 */
describe('attachTurnstileToken', () => {
  it('the default field is cf-turnstile-response (what the widget and the backend KDoc call it)', () => {
    expect(TURNSTILE_RESPONSE_FIELD).toBe('cf-turnstile-response')
  })

  it('adds the token to a JSON body without mutating the original', () => {
    const body = { email: 'a@b.c' }
    const out = attachTurnstileToken(body, 'tok')
    expect(out).toEqual({ email: 'a@b.c', 'cf-turnstile-response': 'tok' })
    expect(body).toEqual({ email: 'a@b.c' })
  })

  it('appends to FormData and URLSearchParams (and returns the same object)', () => {
    const form = new FormData()
    expect(attachTurnstileToken(form, 'tok')).toBe(form)
    expect(form.get('cf-turnstile-response')).toBe('tok')
    const params = new URLSearchParams('a=1')
    attachTurnstileToken(params, 'tok')
    expect(params.get('cf-turnstile-response')).toBe('tok')
  })

  it('the field name is configurable', () => {
    expect(attachTurnstileToken({}, 'tok', { field: 'captchaToken' })).toEqual({
      captchaToken: 'tok',
    })
  })

  it('a missing token is a programming error, not a silent unprotected request', () => {
    expect(() => attachTurnstileToken({}, '')).toThrow(TurnstileTokenMissingError)
    expect(() => attachTurnstileToken({}, null)).toThrow(TurnstileTokenMissingError)
  })
})

describe('turnstileHeaders', () => {
  it('returns a header record for the same token (default CF-Turnstile-Response, configurable)', () => {
    expect(turnstileHeaders('tok')).toEqual({ 'CF-Turnstile-Response': 'tok' })
    expect(turnstileHeaders('tok', { header: 'X-Captcha' })).toEqual({ 'X-Captcha': 'tok' })
    expect(() => turnstileHeaders(undefined)).toThrow(TurnstileTokenMissingError)
  })
})
