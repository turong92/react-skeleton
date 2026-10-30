import { describe, expect, it } from 'vitest'
import { defaultWorkspaceLabels as L } from './labels'
import { validateWorkspaceForm } from './validation'

describe('validateWorkspaceForm — one sentence per wrong field, nothing when it is right', () => {
  it('needs a name (spaces do not count) of at most 100 characters', () => {
    expect(validateWorkspaceForm(L, { name: '  ', slug: '' }).name).toBe(L.form.nameRequired)
    expect(validateWorkspaceForm(L, { name: 'x'.repeat(101), slug: '' }).name).toBe(
      L.form.nameTooLong(100),
    )
    expect(validateWorkspaceForm(L, { name: 'Acme', slug: '' })).toEqual({})
  })
  it('an empty address is fine when the server may pick one (create) and a problem when it may not (settings)', () => {
    expect(validateWorkspaceForm(L, { name: 'Acme', slug: '' }).slug).toBeUndefined()
    expect(validateWorkspaceForm(L, { name: 'Acme', slug: '', slugRequired: true }).slug).toBe(
      L.form.slugLength(3, 40),
    )
  })
  it('explains a short, long or wrongly-written address', () => {
    expect(validateWorkspaceForm(L, { name: 'Acme', slug: 'ab' }).slug).toBe(
      L.form.slugLength(3, 40),
    )
    expect(validateWorkspaceForm(L, { name: 'Acme', slug: 'Ab-c' }).slug).toBe(L.form.slugFormat)
    expect(validateWorkspaceForm(L, { name: 'Acme', slug: 'acme' })).toEqual({})
  })
})
