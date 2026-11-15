import { describe, expect, it } from 'vitest'
import { appStateOf } from './gate'
import type { AppConfig } from './types'

const config = (over: Partial<AppConfig> = {}): AppConfig => ({
  serverTime: '2026-11-16T09:00:00Z',
  maintenance: { enabled: false, message: null, endsAt: null },
  flags: {},
  platforms: {},
  ...over,
})

const web = (minVersion: string | null, recommendedVersion: string | null) => ({
  platforms: { web: { minVersion, recommendedVersion, storeUrl: null } },
})

describe('appStateOf — what the app shows for the config the server gave', () => {
  it('nothing read yet, or nothing set: the app runs', () => {
    expect(appStateOf(undefined, { appVersion: '1.0' })).toEqual({ kind: 'ok' })
    expect(appStateOf(config(), { appVersion: '1.0' })).toEqual({ kind: 'ok' })
  })

  it('maintenance wins over everything, with the message and the expected end', () => {
    const c = config({
      maintenance: { enabled: true, message: 'Back at 10', endsAt: '2026-11-16T10:00:00Z' },
      ...web('9.0', null),
    })
    expect(appStateOf(c, { appVersion: '1.0' })).toEqual({
      kind: 'maintenance',
      message: 'Back at 10',
      endsAt: '2026-11-16T10:00:00Z',
    })
  })

  it('below the minimum is a required update, compared as numbers (1.9 < 1.10)', () => {
    expect(appStateOf(config(web('1.10', null)), { appVersion: '1.9' })).toMatchObject({
      kind: 'update-required',
      minVersion: '1.10',
    })
    expect(appStateOf(config(web('1.9', null)), { appVersion: '1.10' })).toEqual({ kind: 'ok' })
  })

  it('between the minimum and the recommended one is a recommendation, until dismissed', () => {
    const c = config(web('1.0', '1.10'))
    expect(appStateOf(c, { appVersion: '1.9' })).toMatchObject({
      kind: 'update-recommended',
      recommendedVersion: '1.10',
    })
    expect(appStateOf(c, { appVersion: '1.9', dismissed: '1.10' })).toEqual({ kind: 'ok' })
    // 더 새 권장 버전이 나오면 다시 묻는다
    expect(
      appStateOf(config(web('1.0', '1.11')), { appVersion: '1.9', dismissed: '1.10' }),
    ).toMatchObject({ kind: 'update-recommended' })
  })

  it('a platform the server has no rule for, or an app version nobody can read, is never blocked', () => {
    expect(appStateOf(config(web('9.0', null)), { appVersion: '1.0', platform: 'ios' })).toEqual({
      kind: 'ok',
    })
    expect(appStateOf(config(web('9.0', null)), { appVersion: 'dev' })).toEqual({ kind: 'ok' })
    expect(appStateOf(config(web('9.0', null)), {})).toEqual({ kind: 'ok' })
  })
})
