import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { defaultAdminRolesLabels as L, koAdminRolesLabels, mergeRolesLabels } from './rolesLabels'
import { roleErrorMessage } from './rolesErrors'

const err = (code: string, status: number) =>
  new ApiRequestError({ code, title: 't', status, timestamp: 't', traceId: 'tr' }, 'tr', 'sp', 'tp')

describe('roleErrorMessage', () => {
  it.each([
    ['AUTHZ.ROLE_PROTECTED', 409, L.errors.protected],
    ['AUTHZ.ROLE_IN_USE', 409, L.errors.inUse],
    ['AUTHZ.ROLE_EXISTS', 409, L.errors.exists],
    ['AUTHZ.ROLE_NOT_FOUND', 404, L.errors.notFound],
    ['AUTHZ.PERMISSION_UNKNOWN', 400, L.errors.permissionUnknown],
    ['AUTHZ.ESCALATION', 403, L.errors.escalation],
    ['AUTHZ.SELF_LOCKOUT', 409, L.errors.selfLockout],
    ['COMMON.VALIDATION_FAILED', 400, L.errors.validation],
    ['COMMON.INTERNAL_SERVER_ERROR', 500, L.errors.generic],
  ])('%s → its sentence', (code, status, text) => {
    expect(roleErrorMessage(err(code, status), L)).toBe(text)
  })
  it('anything that is not an API error is the generic sentence', () => {
    expect(roleErrorMessage(new Error('x'), L)).toBe(L.errors.generic)
  })
  it('the Korean labels fill every sentence the English ones have', () => {
    const ko = mergeRolesLabels(koAdminRolesLabels)
    for (const key of Object.keys(L.errors) as (keyof typeof L.errors)[])
      expect(ko.errors[key], key).not.toBe(L.errors[key])
    for (const key of Object.keys(L.permissionLabels))
      expect(ko.permissionLabels[key], key).not.toBe(L.permissionLabels[key])
  })
})
