import { describe, expect, it } from 'vitest'
import { findRawLayout } from './index'

/* 간격 · 모서리 · 글자 크기 날값 탐지기가 스스로 맞는지(루트 tests/usage.test.ts 가 이 도구로 화면 CSS 를 막는다) */

describe('findRawLayout (the detector itself)', () => {
  it('finds px / rem / em literals in spacing, radius and font-size declarations', () => {
    expect(findRawLayout('gap: 14px;')).toEqual(['14px'])
    expect(findRawLayout('padding: 0 10px;')).toEqual(['10px'])
    expect(findRawLayout('margin: 12px 0 0;')).toEqual(['12px'])
    expect(findRawLayout('padding: 1rem 2em;')).toEqual(['1rem', '2em'])
    expect(findRawLayout('border-radius: 6px;')).toEqual(['6px'])
    expect(findRawLayout('border-top-left-radius: 4px;')).toEqual(['4px'])
    expect(findRawLayout('font-size: 13px;')).toEqual(['13px'])
    expect(findRawLayout('row-gap: 8px; column-gap: 4px;')).toEqual(['8px', '4px'])
    expect(findRawLayout('margin-inline: 2rem;')).toEqual(['2rem'])
    expect(findRawLayout('gap: 0.5rem 0.0px;')).toEqual(['0.5rem'])
  })

  it('finds literals in inline style objects (camelCase, quoted strings)', () => {
    expect(findRawLayout("style={{ padding: '12px' }}")).toEqual(['12px'])
    expect(findRawLayout("style={{ borderRadius: '6px', marginTop: '4px' }}")).toEqual([
      '6px',
      '4px',
    ])
    expect(findRawLayout("style={{ fontSize: '13px' }}")).toEqual(['13px'])
  })

  it('looks inside calc / min / max / clamp too', () => {
    expect(findRawLayout('padding: calc(var(--space-md) + 3px);')).toEqual(['3px'])
    expect(findRawLayout('gap: clamp(4px, 2vw, var(--space-lg));')).toEqual(['4px'])
  })

  it('allows tokens, zero, auto, percentages and keywords', () => {
    expect(
      findRawLayout(
        'gap: var(--space-md); padding: 0 var(--space-lg); margin: 0 auto; margin-top: 0px;' +
          'border-radius: var(--radius-md); border-radius: 50%; font-size: var(--font-size-small);' +
          'font-size: inherit; padding-inline: 5%; margin: -1px;',
      ),
    ).toEqual(['-1px'])
  })

  it('does not look at sizes, borders, outlines, content or ids', () => {
    expect(
      findRawLayout(
        'width: 34px; min-height: 38px; border: 1px solid var(--border); outline: 3px solid red; ' +
          "content: '12px'; top: 4px; max-width: 800px; width: min(480px, calc(100vw - 32px));" +
          '#root { min-height: 100svh; } a[href="#top"] { }',
      ),
    ).toEqual([])
  })

  it('does not mistake a custom property declaration or a longer name for a layout property', () => {
    expect(findRawLayout('--gap-thing: 4px; scroll-padding: 4px; line-height: 1.5;')).toEqual([])
  })
})
