import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { invitationProblem, workspaceProblem } from './errors'

const failure = (status: number, code: string) =>
  new ApiRequestError({ code, title: code, status } as never, 't', 's', 'p')

describe('workspaceProblem — one word per failure the screens explain', () => {
  it('maps the module codes', () => {
    expect(workspaceProblem(failure(409, 'WORKSPACE.SLUG_TAKEN'))).toBe('slugTaken')
    expect(workspaceProblem(failure(409, 'WORKSPACE.OWNER_CANNOT_LEAVE'))).toBe('ownerCannotLeave')
    expect(workspaceProblem(failure(404, 'WORKSPACE.MEMBER_NOT_FOUND'))).toBe('memberGone')
    expect(workspaceProblem(failure(404, 'WORKSPACE.NOT_FOUND'))).toBe('notFound')
    expect(workspaceProblem(failure(403, 'WORKSPACE.FORBIDDEN'))).toBe('forbidden')
  })
  it('anything else is "other" (the screen shows its generic sentence and the trace reference)', () => {
    expect(workspaceProblem(failure(500, 'COMMON.INTERNAL'))).toBe('other')
    expect(workspaceProblem(new Error('x'))).toBe('other')
    expect(workspaceProblem(undefined)).toBe('other')
  })
})

describe('invitationProblem — one word per invitation failure the screens explain', () => {
  const invalid = (reason?: unknown) =>
    new ApiRequestError(
      { code: 'WORKSPACE.INVITATION_INVALID', title: 'x', status: 400, data: { reason } } as never,
      't',
      's',
      'p',
    )
  it('INVITATION_INVALID is told apart by its reason (the token holder is allowed to know)', () => {
    expect(invitationProblem(invalid('EXPIRED'))).toBe('expired')
    expect(invitationProblem(invalid('USED'))).toBe('used')
    expect(invitationProblem(invalid('INVALID'))).toBe('invalid')
    expect(invitationProblem(invalid(undefined))).toBe('invalid')
    expect(invitationProblem(invalid('SOMETHING_NEW'))).toBe('invalid')
  })
  it('maps the accept and invite codes', () => {
    expect(invitationProblem(failure(403, 'WORKSPACE.INVITATION_EMAIL_MISMATCH'))).toBe(
      'emailMismatch',
    )
    expect(invitationProblem(failure(403, 'WORKSPACE.EMAIL_UNVERIFIED'))).toBe('emailUnverified')
    expect(invitationProblem(failure(409, 'WORKSPACE.ALREADY_MEMBER'))).toBe('alreadyMember')
    expect(invitationProblem(failure(409, 'WORKSPACE.SEAT_LIMIT'))).toBe('seatLimit')
    expect(invitationProblem(failure(429, 'WORKSPACE.RESEND_TOO_SOON'))).toBe('resendTooSoon')
    expect(invitationProblem(failure(409, 'WORKSPACE.TOO_MANY_PENDING'))).toBe('tooManyPending')
    expect(invitationProblem(failure(403, 'WORKSPACE.FORBIDDEN'))).toBe('forbidden')
  })
  it('anything else is "other"', () => {
    expect(invitationProblem(failure(500, 'COMMON.INTERNAL'))).toBe('other')
    expect(invitationProblem(new Error('x'))).toBe('other')
  })
})
