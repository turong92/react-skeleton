import { ApiRequestError, ErrorCodes, type ApiError } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { defaultAuthorProfileLabels as L } from './labels'
import { foldDuration } from './duration'
import {
  isAuthorProfileFormError,
  nameProblem,
  profileFormProblem,
  shouldReuseIdempotencyKey,
} from './errors'

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
    ).toEqual({ where: 'form', message: L.rateLimited(foldDuration(90)) })
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

describe("isAuthorProfileFormError — which errors the app's global toast must skip", () => {
  it('only AUTHOR_PROFILE.* codes: the form says those in place', () => {
    for (const code of [
      ErrorCodes.AUTHOR_PROFILE_NAME_TAKEN,
      ErrorCodes.AUTHOR_PROFILE_LIMIT_REACHED,
      ErrorCodes.AUTHOR_PROFILE_RATE_LIMITED,
      ErrorCodes.AUTHOR_PROFILE_NOT_FOUND,
    ])
      expect(isAuthorProfileFormError(err({ code }))).toBe(true)
  })

  it("a 400 name field error is NOT claimed — other forms (nickname) share that shape; the app's own validation-failure filter (sample: COMMON.VALIDATION_FAILED in errorToast.ts) already keeps those out of the toast", () => {
    expect(
      isAuthorProfileFormError(
        err({ errors: [{ field: 'name', code: 'Required', message: 'x' }] }),
      ),
    ).toBe(false)
  })

  it('anything else — another module, a plain Error — is not ours', () => {
    expect(isAuthorProfileFormError(err({ code: 'BOARD.FORBIDDEN', status: 403 }))).toBe(false)
    expect(isAuthorProfileFormError(new Error('boom'))).toBe(false)
  })
})

describe('shouldReuseIdempotencyKey — a resend keeps its key only when the first try may have landed unseen', () => {
  it('only a network failure (status 0): the request may have reached the server while the answer was lost', () => {
    expect(shouldReuseIdempotencyKey(err({ code: 'CLIENT.NETWORK_ERROR', status: 0 }))).toBe(true)
  })

  it('a server error (5xx) is an answer too: the next try is a new submission with a new key', () => {
    expect(shouldReuseIdempotencyKey(err({ code: 'COMMON.INTERNAL', status: 503 }))).toBe(false)
    expect(shouldReuseIdempotencyKey(err({ code: 'COMMON.INTERNAL', status: 500 }))).toBe(false)
  })

  it('so is a 4xx (name taken, limit, validation), and so is anything that is not an API error', () => {
    expect(
      shouldReuseIdempotencyKey(err({ code: ErrorCodes.AUTHOR_PROFILE_NAME_TAKEN, status: 409 })),
    ).toBe(false)
    expect(shouldReuseIdempotencyKey(err({ status: 400 }))).toBe(false)
    expect(shouldReuseIdempotencyKey(new Error('offline'))).toBe(false)
  })
})
