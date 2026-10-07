import { describe, expect, it } from 'vitest'
import en from './en'
import ko from './ko'

/*
 * 사용자에게는 개념이 하나다 — 「닉네임」. 코드 · 패키지 이름의 「프로필」은 화면에 나오지 않는다.
 * (`@skeleton/auth` 의 계정 화면 문구는 sample 이 덮어 쓴 것을 `useAuthLabels` 가 합쳐 준다 — `auth/useAuthLabels.test.ts`)
 */
describe('the Notes dictionaries never say "profile" — one concept for the user: a nickname', () => {
  it('ko has no 「프로필」', () => {
    const found = Object.entries(ko).filter(([, text]) => text.includes('프로필'))
    expect(found.map(([key]) => key)).toEqual([])
  })

  it('en has no "profile"', () => {
    const found = Object.entries(en).filter(([, text]) => /profile/i.test(text))
    expect(found.map(([key]) => key)).toEqual([])
  })

  it('the account nickname (a private account name) is not explained to the user any more', () => {
    for (const dictionary of [ko, en]) {
      for (const gone of ['nickname', 'nicknameNone', 'nicknameSet', 'nicknameHint'])
        expect(dictionary).not.toHaveProperty(`settings.${gone}`)
    }
  })
})
