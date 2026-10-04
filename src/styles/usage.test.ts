/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { findRawColors } from '../test/rawColors'

/*
 * 화면 코드가 토큰 층을 지키는지 — 날 색 금지 · 원시(--p-*) 직접 사용 금지 · 쓰는 var(--x) 는 모두 정의됨.
 * 생성 파일 src/styles/tokens.css 는 값을 정의하는 곳이라 대상에서 뺀다.
 */
const SRC = fileURLToPath(new URL('../', import.meta.url))
const GENERATED = join(SRC, 'styles/tokens.css')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}
const files = walk(SRC)
const screenCss = files.filter((f) => f.endsWith('.css') && f !== GENERATED)
const screenTsx = files.filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
const rel = (f: string) => relative(SRC, f)
const text = (f: string) => readFileSync(f, 'utf8')

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

describe('screen code', () => {
  it('there is screen CSS and TSX to check', () => {
    expect(screenCss.length).toBeGreaterThan(0)
    expect(screenTsx.length).toBeGreaterThan(0)
  })

  it.each(screenCss.map(rel))('%s has no raw colour values', (file) => {
    expect(findRawColors(text(join(SRC, file)))).toEqual([])
  })

  it.each(screenTsx.map(rel))('%s has no raw colour in inline styles', (file) => {
    expect(findRawColors(text(join(SRC, file)))).toEqual([])
  })

  it('does not use primitives (--p-*) directly', () => {
    const offenders = [...screenCss, ...screenTsx].filter((f) => /var\(\s*--p-/.test(text(f)))
    expect(offenders.map(rel)).toEqual([])
  })

  it('every var(--x) used in src is defined in tokens.css', () => {
    const defined = new Set([...text(GENERATED).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))
    const used = new Map<string, string>()
    for (const f of [...screenCss, ...screenTsx])
      for (const m of text(f).matchAll(/var\(\s*(--[\w-]+)/g)) used.set(m[1], rel(f))
    const undefinedVars = [...used]
      .filter(([name]) => !defined.has(name))
      .map(([n, f]) => `${n} (${f})`)
    expect(undefinedVars).toEqual([])
  })
})
