import { describe, expect, it } from 'vitest'
import { contrast, findRawColors, over, parseColor } from './index'

/* 토큰 층을 지키는 테스트들이 쓰는 도구(색 대비 · 날 색 탐지)가 스스로 맞는지 */

describe('contrast helper', () => {
  it('black on white is 21:1, same colour is 1:1', () => {
    expect(contrast(parseColor('#000'), parseColor('#ffffff'))).toBeCloseTo(21, 5)
    expect(contrast(parseColor('#777'), parseColor('#777777'))).toBeCloseTo(1, 5)
  })

  it('composites a translucent colour over its backdrop', () => {
    const out = over(parseColor('rgba(0, 0, 0, 0.5)'), parseColor('#ffffff'))
    expect(out).toEqual({ r: 127.5, g: 127.5, b: 127.5, a: 1 })
  })
})

describe('findRawColors (the detector itself)', () => {
  it('finds hex, rgb(a), hsl and named colours in colour-bearing declarations', () => {
    expect(findRawColors('color: #fff;')).toEqual(['#fff'])
    expect(findRawColors('background: rgba(255, 255, 255, 0.92);')).toEqual([
      'rgba(255, 255, 255, 0.92)',
    ])
    expect(findRawColors('border: 1px solid #15211d;')).toEqual(['#15211d'])
    expect(findRawColors('box-shadow: 0 1px 2px hsl(0 0% 0% / 20%);')).toEqual([
      'hsl(0 0% 0% / 20%)',
    ])
    expect(findRawColors('color: white;')).toEqual(['white'])
    expect(findRawColors("style={{ color: '#c0392b' }}")).toEqual(['#c0392b'])
    expect(findRawColors("style={{ border: '1px solid #fcc' }}")).toEqual(['#fcc'])
  })

  it('allows tokens and keywords', () => {
    expect(
      findRawColors(
        'color: var(--text); background: transparent; border-color: currentColor; ' +
          'outline: 3px solid var(--teal-soft); background: linear-gradient(90deg, var(--teal-wash), transparent 36%), var(--surface);',
      ),
    ).toEqual([])
  })

  it('does not mistake ids, urls or non-colour properties for colours', () => {
    expect(findRawColors('#root { min-height: 100svh; } a[href="#top"] { }')).toEqual([])
    expect(findRawColors("content: '#fff';")).toEqual([])
  })
})
