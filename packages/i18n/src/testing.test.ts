import { describe, expect, it } from 'vitest'
import { catalogProblems, messageArguments } from './testing'

const ko = {
  'a.hello': '안녕하세요, {name}님',
  'a.items': '{count, plural, =0 {없음} other {# 개}}',
  'a.rich': '<b>굵게</b> 보통',
  'a.plain': '그냥 글',
}
const good = {
  'a.hello': 'Hello, {name}',
  'a.items': '{count, plural, =0 {None} one {# item} other {# items}}',
  'a.rich': '<b>Bold</b> plain',
  'a.plain': 'Just text',
}
const run = (en: Record<string, string>, extra = {}) =>
  catalogProblems({ ko, en }, { defaultLocale: 'ko', ...extra })

describe('messageArguments', () => {
  it('lists plain, plural, select and tag names, also inside branches', () => {
    expect(
      [
        ...messageArguments(
          '{n, plural, one {<b>{who}</b>} other {{g, select, f {x} other {y}}}} {when, date}',
        ),
      ].sort(),
    ).toEqual(['b', 'g', 'n', 'when', 'who'])
  })
})

describe('catalogProblems', () => {
  it('finds nothing in catalogs that match', async () => {
    expect(await run(good)).toEqual([])
  })

  it('reports a key missing from a translation and a key the default does not have', async () => {
    const { 'a.plain': _omit, ...withoutPlain } = good
    const problems = await run({ ...withoutPlain, 'a.extra': 'Extra' })
    expect(problems).toContain('en: missing key "a.plain" (present in ko)')
    expect(problems).toContain('en: extra key "a.extra" (not in ko)')
  })

  it('reports a message that is not valid ICU', async () => {
    const problems = await run({ ...good, 'a.hello': 'Hello, {name' })
    expect(problems.some((p) => p.startsWith('en "a.hello": not valid ICU'))).toBe(true)
  })

  it('reports an argument the translation uses but the default does not (the code never passes it)', async () => {
    expect(await run({ ...good, 'a.plain': 'Just {oops}' })).toContain(
      'en "a.plain": uses {oops}, which ko does not',
    )
  })

  it('reports an argument the translation drops (the value is passed but never shown)', async () => {
    expect(await run({ ...good, 'a.hello': 'Hello' })).toContain(
      'en "a.hello": does not use {name}, which ko does',
    )
  })

  it('allowOmittedArgs lets a translation drop an argument (a language that needs no honorific) but still not add one', async () => {
    expect(await run({ ...good, 'a.hello': 'Hello' }, { allowOmittedArgs: true })).toEqual([])
    expect(
      await run({ ...good, 'a.plain': 'Just {oops}' }, { allowOmittedArgs: true }),
    ).not.toEqual([])
  })

  it('reports a tag the translation drops', async () => {
    expect(await run({ ...good, 'a.rich': 'Bold plain' })).toContain(
      'en "a.rich": does not use {b}, which ko does',
    )
  })

  it("reports an ASCII apostrophe next to ICU syntax (it quotes and silently eats text) but not an ordinary don't", async () => {
    expect(await run({ ...good, 'a.plain': "It'{s}" })).toEqual(
      expect.arrayContaining([expect.stringContaining('apostrophe')]),
    )
    expect(await run({ ...good, 'a.plain': "Don't panic" })).toEqual([])
  })

  it('reports an empty message and a non-string value', async () => {
    expect(await run({ ...good, 'a.plain': '  ' })).toContain('en "a.plain": empty message')
    expect(await run({ ...good, 'a.plain': 3 as never })).toContain('en "a.plain": not a string')
  })

  it('awaits lazy catalogs (the same loaders the app uses)', async () => {
    const problems = await catalogProblems(
      { ko, en: async () => ({ default: { ...good, 'a.plain': '' } }) },
      { defaultLocale: 'ko' },
    )
    expect(problems).toEqual(['en "a.plain": empty message'])
  })

  it('checks every locale and names the one with the problem', async () => {
    const problems = await catalogProblems(
      { ko, en: good, ja: { ...good, 'a.plain': 'x {y}' } },
      { defaultLocale: 'ko' },
    )
    expect(problems).toEqual(['ja "a.plain": uses {y}, which ko does not'])
  })

  it('throws a clear error if the default locale is not among the catalogs', async () => {
    await expect(catalogProblems({ en: good }, { defaultLocale: 'ko' })).rejects.toThrow(
      /default locale/i,
    )
  })
})
