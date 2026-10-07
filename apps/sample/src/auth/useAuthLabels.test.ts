import { koAuthLabels, mergeLabels } from '@skeleton/auth'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { appAuthLabels } from './useAuthLabels'

afterEach(async () => {
  await i18n.setLocale('ko', { remember: false })
})

const strings = (labels: object) =>
  Object.values(labels).filter((value): value is string => typeof value === 'string')

describe("appAuthLabels — the account screens speak the app's one word, 닉네임", () => {
  it('ko: no 「프로필」 anywhere on the account screens, and the sign-up hint says it becomes the first nickname', () => {
    const labels = mergeLabels(appAuthLabels('ko', i18n.t))
    expect(strings(labels).filter((text) => text.includes('프로필'))).toEqual([])
    expect(labels.displayNameHint).toBe('첫 닉네임이 돼요. 나중에 더 만들거나 바꿀 수 있어요.')
    expect(labels.displayName).toBe(koAuthLabels.displayName) // 가입 화면의 칸 이름은 그대로 「닉네임」
  })

  it('en: no "profile" either, and the same hint idea', async () => {
    await i18n.setLocale('en', { remember: false })
    const labels = mergeLabels(appAuthLabels('en', i18n.t))
    expect(strings(labels).filter((text) => /profile/i.test(text))).toEqual([])
    expect(labels.displayNameHint).toMatch(/first nickname/)
    expect(labels.displayName).toBe('Nickname')
  })
})
