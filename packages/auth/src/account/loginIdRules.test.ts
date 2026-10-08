import { describe, expect, it } from 'vitest'
import {
  loginIdProblem,
  loginIdServerCode,
  normalizeLoginId,
  type LoginIdProblem,
  type LoginIdRules,
} from './loginIdRules'

/*
 * 백엔드 `LoginIds`(설계 §4)와 같은 판정 — 사례 묶음은 그 표의 줄을 그대로 옮긴 것이다.
 * 정규화한 값이 `^[a-z0-9]+([._-][a-z0-9]+)*$`, 길이 min~max, 영문 하나 이상.
 */
const rules: LoginIdRules = { minLength: 4, maxLength: 20 }

describe('normalizeLoginId', () => {
  it('trims and lower-cases, nothing else (no repairing of odd characters)', () => {
    expect(normalizeLoginId('  Sumin.Kim ')).toBe('sumin.kim')
    expect(normalizeLoginId('A_B-C.D')).toBe('a_b-c.d')
    expect(normalizeLoginId('수민')).toBe('수민')
    expect(normalizeLoginId('ＡＢＣＤ')).toBe('ａｂｃｄ') // full-width stays full-width: it is refused, not fixed
  })
})

describe('loginIdProblem — what the rule table accepts', () => {
  it.each([
    ['sumin', 'letters'],
    ['sumin.kim', 'period inside'],
    ['sumin-kim', 'hyphen inside'],
    ['sumin_kim', 'underscore inside'],
    ['1sumin', 'starts with a digit'],
    ['2024kim', 'starts with digits'],
    ['a1b2', 'letters and digits'],
    ['Sumin.Kim', 'capitals are accepted (stored in lower case)'],
    ['  sumin  ', 'surrounding blanks are trimmed'],
    ['a.b-c_d', 'all three symbols, one at a time'],
    ['abcd', 'exactly the minimum'],
    ['a'.repeat(20), 'exactly the maximum'],
    ['1234a', 'a single letter is enough'],
  ])('%s (%s)', (value) => {
    expect(loginIdProblem(value, rules)).toBeUndefined()
  })
})

describe('loginIdProblem — what it refuses, and which kind of problem it is', () => {
  const cases: Array<[string, LoginIdProblem]> = [
    // 없음
    ['', 'missing'],
    ['   ', 'missing'],
    // 길이
    ['abc', 'size'],
    ['a'.repeat(21), 'size'],
    ['a.b', 'size'],
    // 쓸 수 없는 글자 (`@` · 공백 · 한글 · 전각 · 그 밖의 기호)
    ['sumin@kim', 'chars'],
    ['sumin@example.com', 'chars'],
    ['su min', 'chars'],
    ['수민수민', 'chars'],
    ['ｓｕｍｉｎ', 'chars'],
    ['sumin!', 'chars'],
    ['sumin+kim', 'chars'],
    ['su/min', 'chars'],
    ['sümin', 'chars'],
    // 맨 앞 · 맨 뒤 기호
    ['.sumin', 'symbols'],
    ['-sumin', 'symbols'],
    ['_sumin', 'symbols'],
    ['sumin.', 'symbols'],
    ['sumin-', 'symbols'],
    ['sumin_', 'symbols'],
    // 연속 기호 — 기호 둘이 붙는 모든 조합
    ['su..min', 'symbols'],
    ['su--min', 'symbols'],
    ['su__min', 'symbols'],
    ['su._min', 'symbols'],
    ['su.-min', 'symbols'],
    ['su_.min', 'symbols'],
    ['su_-min', 'symbols'],
    ['su-.min', 'symbols'],
    ['su-_min', 'symbols'],
    // 숫자만
    ['1234', 'digitsOnly'],
    ['0123456789', 'digitsOnly'],
    ['12.34', 'digitsOnly'],
    ['12-34-56', 'digitsOnly'],
  ]
  it.each(cases)('%j is %s', (value, kind) => {
    expect(loginIdProblem(value, rules)).toBe(kind)
  })

  it('judges the normalized value: capitals and blanks around do not hide or create a problem', () => {
    expect(loginIdProblem('  SUMIN.  ', rules)).toBe('symbols')
    expect(loginIdProblem(' ABC ', rules)).toBe('size')
  })

  it('the length bounds come from the server (GET /auth/methods), not from a constant', () => {
    expect(loginIdProblem('abcd', { minLength: 5, maxLength: 20 })).toBe('size')
    expect(loginIdProblem('abcdef', { minLength: 3, maxLength: 5 })).toBe('size')
    expect(loginIdProblem('abc', { minLength: 3, maxLength: 5 })).toBeUndefined()
  })

  it('when several things are wrong the reported kind is the same for the same input (chars, then size, then symbols, then digits only)', () => {
    expect(loginIdProblem('a@', rules)).toBe('chars') // also short
    expect(loginIdProblem('1.', rules)).toBe('size') // also a trailing symbol and digits only
    expect(loginIdProblem('12.', { minLength: 1, maxLength: 20 })).toBe('symbols') // also digits only
  })
})

describe('loginIdServerCode — the code the server answers with for the same kind (Required · Size · Pattern)', () => {
  it('missing → Required, size → Size, every other kind → Pattern', () => {
    expect(loginIdServerCode('missing')).toBe('Required')
    expect(loginIdServerCode('size')).toBe('Size')
    for (const kind of ['chars', 'symbols', 'digitsOnly'] as const)
      expect(loginIdServerCode(kind)).toBe('Pattern')
  })
})
