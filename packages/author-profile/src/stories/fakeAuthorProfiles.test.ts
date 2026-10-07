import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createFakeAuthorProfiles } from './fakeAuthorProfiles'

/** 가짜 서버가 계약(packages/author-profile/README.md · 백엔드 modules/author-profile)의 규칙을 지키는지 — 스토리의 근거가 거짓이면 안 된다 */
const rejects = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error,
  )
const codeOf = (error: unknown) => (error as ApiRequestError).apiError.code
const statusOf = (error: unknown) => (error as ApiRequestError).apiError.status

describe('fake author profiles', () => {
  it('creates profiles with distinct tags for the same name (overlap is not blocked, only told apart)', async () => {
    const { api } = createFakeAuthorProfiles()
    const a = await api.create({ name: 'Ann' })
    const b = await api.create({ name: 'Ann' })
    expect(a.id).toMatch(/^prf_/)
    expect(a.tag).not.toBe(b.tag)
    expect((await api.list()).map((p) => p.name)).toEqual(['Ann', 'Ann'])
  })

  it('config reports the limits; reaching maxPerAccount is a 409 LIMIT_REACHED', async () => {
    const { api } = createFakeAuthorProfiles({ maxPerAccount: 1 })
    expect(await api.getConfig()).toEqual({ maxPerAccount: 1, nameMaxLength: 60 })
    await api.create({ name: 'Ann' })
    const error = await rejects(api.create({ name: 'Bea' }))
    expect(codeOf(error)).toBe(ErrorCodes.AUTHOR_PROFILE_LIMIT_REACHED)
    expect(statusOf(error)).toBe(409)
  })

  it('the name field answers 400 with the nickname codes: Required · Size · Pattern · Reserved', async () => {
    const { api } = createFakeAuthorProfiles()
    const field = async (name: string) =>
      ((await rejects(api.create({ name }))) as ApiRequestError).apiError.errors?.[0]
    expect(await field('  ')).toMatchObject({ field: 'name', code: 'Required' })
    expect(await field('a'.repeat(61))).toMatchObject({ field: 'name', code: 'Size' })
    expect(await field('a#b')).toMatchObject({ field: 'name', code: 'Pattern' })
    expect(await field('admin')).toMatchObject({ field: 'name', code: 'Reserved' })
  })

  it('takenNames are names somebody else holds: 409 NAME_TAKEN whatever the case; your own names are not blocked', async () => {
    const { api } = createFakeAuthorProfiles({ takenNames: ['Ann'] })
    expect(codeOf(await rejects(api.create({ name: 'ann' })))).toBe(
      ErrorCodes.AUTHOR_PROFILE_NAME_TAKEN,
    )
    const bea = await api.create({ name: 'Bea' })
    await api.create({ name: 'Bea' }) // 내 이름끼리 겹침은 막지 않는다(꼬리표로 구분)
    expect(codeOf(await rejects(api.rename(bea.id, { name: 'ANN' })))).toBe(
      ErrorCodes.AUTHOR_PROFILE_NAME_TAKEN,
    )
  })

  it('failNext fails the next call of that kind once, with that code (keys: create · rename · remove)', async () => {
    const { api } = createFakeAuthorProfiles({
      failNext: { create: 'AUTHOR_PROFILE.LIMIT_REACHED' },
    })
    expect(codeOf(await rejects(api.create({ name: 'Ann' })))).toBe(
      ErrorCodes.AUTHOR_PROFILE_LIMIT_REACHED,
    )
    await api.create({ name: 'Ann' }) // 한 번뿐
    expect(await api.list()).toHaveLength(1)
  })

  it('a failNext NOT_FOUND means "gone elsewhere": the profile is not in the list afterwards', async () => {
    const { api } = createFakeAuthorProfiles({ failNext: { remove: 'AUTHOR_PROFILE.NOT_FOUND' } })
    const a = await api.create({ name: 'Ann' })
    expect(codeOf(await rejects(api.remove(a.id)))).toBe(ErrorCodes.AUTHOR_PROFILE_NOT_FOUND)
    expect(await api.list()).toEqual([])
  })

  it('rateLimited answers 429 with the wait', async () => {
    const { api } = createFakeAuthorProfiles({ rateLimited: true })
    const error = await rejects(api.create({ name: 'Ann' }))
    expect(codeOf(error)).toBe(ErrorCodes.AUTHOR_PROFILE_RATE_LIMITED)
    expect(statusOf(error)).toBe(429)
  })

  it('renames in place (same name keeps the tag) and removes for good; unknown ids are 404 NOT_FOUND', async () => {
    const { api } = createFakeAuthorProfiles()
    const a = await api.create({ name: 'Ann' })
    expect((await api.rename(a.id, { name: 'Ann' })).tag).toBe(a.tag)
    expect((await api.rename(a.id, { name: 'Zed' })).name).toBe('Zed')
    await api.remove(a.id)
    expect(await api.list()).toEqual([])
    expect(codeOf(await rejects(api.remove(a.id)))).toBe(ErrorCodes.AUTHOR_PROFILE_NOT_FOUND)
    expect(codeOf(await rejects(api.rename('prf_nope', { name: 'x' })))).toBe(
      ErrorCodes.AUTHOR_PROFILE_NOT_FOUND,
    )
  })
})
