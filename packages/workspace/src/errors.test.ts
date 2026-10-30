import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { workspaceProblem } from './errors'

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
