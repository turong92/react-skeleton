import { ApiRequestError, ErrorCodes, type ApiError } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { defaultAuthorProfileLabels as L } from './labels'
import { nameProblem, profileFormProblem } from './errors'

const limits = { maxPerAccount: 5, nameMaxLength: 60 }

const err = (over: Partial<ApiError>) =>
  new ApiRequestError(
    { code: 'X', title: 't', status: 400, timestamp: 'now', ...over },
    'trace',
    'span',
    'tp',
  )

describe('profileFormProblem — the server answers a profile name form can show in place', () => {
  it('NAME_TAKEN → the name field', () => {
    expect(
      profileFormProblem(
        err({ code: ErrorCodes.AUTHOR_PROFILE_NAME_TAKEN, status: 409 }),
        L,
        limits,
      ),
    ).toEqual({ where: 'name', message: L.nameTaken })
  })

  it('field errors on `name` map by code to our sentences, never the server English', () => {
    const at = (code: string) =>
      profileFormProblem(
        err({ errors: [{ field: 'name', code, message: 'server english' }] }),
        L,
        limits,
      )
    expect(at('Required')).toEqual({ where: 'name', message: L.nameRequired })
    expect(at('Pattern')).toEqual({ where: 'name', message: L.namePattern })
    expect(at('Reserved')).toEqual({ where: 'name', message: L.nameReserved })
    expect(at('Size')).toEqual({ where: 'name', message: L.nameTooLong(60) })
  })

  it('LIMIT_REACHED and RATE_LIMITED are about the form as a whole', () => {
    expect(
      profileFormProblem(
        err({ code: ErrorCodes.AUTHOR_PROFILE_LIMIT_REACHED, status: 409 }),
        L,
        limits,
      ),
    ).toEqual({ where: 'form', message: L.limitReached(5) })
    expect(
      profileFormProblem(
        err({ code: ErrorCodes.AUTHOR_PROFILE_RATE_LIMITED, status: 429 }),
        L,
        limits,
      ),
    ).toEqual({ where: 'form', message: L.rateLimited(undefined) })
    expect(
      profileFormProblem(
        err({
          code: ErrorCodes.AUTHOR_PROFILE_RATE_LIMITED,
          status: 429,
          data: { retryAfterSeconds: 90 },
        }),
        L,
        limits,
      ),
    ).toEqual({ where: 'form', message: L.rateLimited(90) })
  })

  it('NOT_FOUND says the profile is gone; anything else is the generic sentence', () => {
    expect(
      profileFormProblem(
        err({ code: ErrorCodes.AUTHOR_PROFILE_NOT_FOUND, status: 404 }),
        L,
        limits,
      ),
    ).toEqual({ where: 'form', message: L.notFound })
    expect(profileFormProblem(new Error('boom'), L, limits)).toEqual({
      where: 'form',
      message: L.failed,
    })
  })

  it('undefined when there is no error', () => {
    expect(profileFormProblem(null, L, limits)).toBeUndefined()
  })
})

describe('nameProblem — what the form can say before asking the server', () => {
  it('blank, over the length (counted in code points), and the # @ characters the tag and the mention use', () => {
    expect(nameProblem('   ', L, limits)).toBe(L.nameRequired)
    expect(nameProblem('a'.repeat(61), L, limits)).toBe(L.nameTooLong(60))
    expect(nameProblem('👩‍💻'.repeat(1), L, limits)).toBeUndefined()
    expect(nameProblem('수#민', L, limits)).toBe(L.namePattern)
    expect(nameProblem('@수민', L, limits)).toBe(L.namePattern)
  })

  it('a good name, spaces around it ignored, has no problem', () => {
    expect(nameProblem('  Ann  ', L, limits)).toBeUndefined()
    expect(nameProblem('a'.repeat(60), L, limits)).toBeUndefined()
  })
})
