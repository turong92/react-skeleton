import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * `@skeleton/board` 의 `AuthorPickerArgs`(선택기 렌더 함수가 받는 것)와 `@skeleton/author-profile` 의 `AuthorPickerSlotProps`(선택기가 받는 것)는 서로를 import 하지 않는다 —
 * 그래서 어긋나도 타입 검사가 모른다. 두 정의를 읽어 속성 이름 · 선택 여부 · 타입 글자가 같은지 본다(board 가 인자를 더하면 여기서 멈춘다).
 * 패키지를 일부만 가져간 프로젝트에서는 두 파일이 모두 있을 때만 잰다.
 */
const root = resolve(__dirname, '..')
const boardFile = resolve(root, 'packages/board/src/authorship.ts')
const profileFile = resolve(root, 'packages/author-profile/src/AuthorPicker.tsx')

/** `export type <name> = {` 부터 첫 `\n}` 까지의 속성들 — 주석을 걷고 `이름[?]: 타입` 으로 */
function props(file: string, name: string): Map<string, string> {
  const source = readFileSync(file, 'utf8')
  const start = source.indexOf(`export type ${name} = {`)
  expect(start, `${name} in ${file}`).toBeGreaterThanOrEqual(0)
  const body = source
    .slice(start, source.indexOf('\n}', start))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
  const found = new Map<string, string>()
  for (const match of body.matchAll(/^\s*('?[\w-]+'?)(\??):\s*(.+?)\s*$/gm))
    found.set(match[1].replaceAll("'", ''), `${match[2]}:${match[3]}`)
  return found
}

describe.skipIf(!existsSync(boardFile) || !existsSync(profileFile))(
  'author picker contract: board → author-profile',
  () => {
    it('the picker accepts exactly what the board hands it (same names, optionality and types)', () => {
      const board = props(boardFile, 'AuthorPickerArgs')
      const picker = props(profileFile, 'AuthorPickerSlotProps')
      expect(board.size).toBeGreaterThan(5)
      expect(Object.fromEntries(picker)).toEqual(Object.fromEntries(board))
    })
  },
)
