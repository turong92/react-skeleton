import { describe, expect, it } from 'vitest'
import { defaultAuthorProfileLabels as labels } from './labels'

/** 모든 문구(문자열 · 문구 함수의 결과) — 함수는 이름 · 숫자를 넣어 불러 본다 */
function everySentence(): string[] {
  const out: string[] = []
  for (const value of Object.values(labels)) {
    if (typeof value === 'string') out.push(value)
    else {
      const call = value as (...args: unknown[]) => string
      out.push(call('Ann#0001', 'Bea#0002'), call(undefined), call(3, 5))
      out.push(call({ value: 2, unit: 'minute' }))
    }
  }
  return out
}

describe('default labels speak of one concept: a nickname (the word "profile" is for code, not for the screen)', () => {
  it('never says "profile"', () => {
    const bad = everySentence().filter((sentence) => /profile/i.test(sentence))
    expect(bad).toEqual([])
  })

  it('calls the things people pick and add "nickname"', () => {
    expect(labels.choose).toBe('Choose a nickname')
    expect(labels.add).toBe('Add nickname')
    expect(labels.nameLabel).toBe('New nickname')
    expect(labels.count(3, 5)).toBe('3 of 5 nicknames')
    expect(labels.renameAction).toBe('Change')
  })
})

describe('the switch confirmation does not lean on grammar particles', () => {
  it('names both nicknames in one plain sentence', () => {
    const sentence = labels.switchNotice('Ann#0001', 'Bea#0002')
    expect(sentence).toContain("'Ann#0001'")
    expect(sentence).toContain("'Bea#0002'")
  })

  it('has two fixed button texts, no name inside them', () => {
    expect(labels.switchConfirm).toBe('Use as is')
    expect(labels.switchKeep).toBe('Switch back')
  })
})
