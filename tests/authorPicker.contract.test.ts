import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REPO } from './support/loadWorkspaces'

/*
 * `@skeleton/board` 의 `AuthorPickerArgs`(선택기 렌더 함수가 받는 것)와 `@skeleton/author-profile` 의 `AuthorPickerSlotProps`(선택기가 받는 것)는 서로를 import 하지 않는다 —
 * 그래서 어긋나도 타입 검사가 모른다. 두 정의를 읽어 속성 이름 · 선택 여부 · 타입 글자가 같은지 본다(board 가 인자를 더하면 여기서 멈춘다).
 * 패키지 폴더가 둘 다 있는 프로젝트에서만 잰다 — 폴더가 있는데 정의 파일이 없거나 정의를 읽지 못하면 **실패**한다(조용히 건너뛰지 않는다).
 */
const BOARD = {
  dir: 'packages/board',
  file: 'packages/board/src/authorship.ts',
  type: 'AuthorPickerArgs',
}
const PICKER = {
  dir: 'packages/author-profile',
  file: 'packages/author-profile/src/AuthorPickerView.tsx',
  type: 'AuthorPickerSlotProps',
}

/** `export type <name> = {` 부터 첫 `\n}` 까지의 속성들 — 주석을 걷고 `이름[?]: 타입` 으로. 읽히지 않는 줄이 하나라도 남으면 실패 */
function props({ file, type }: { file: string; type: string }): Map<string, string> {
  const path = join(REPO, file)
  expect(existsSync(path), `${file} exists`).toBe(true)
  const source = readFileSync(path, 'utf8')
  const start = source.indexOf(`export type ${type} = {`)
  expect(start, `${type} in ${file}`).toBeGreaterThanOrEqual(0)
  const body = source
    .slice(source.indexOf('{', start) + 1, source.indexOf('\n}', start))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
  const found = new Map<string, string>()
  for (const line of body.split('\n').filter((l) => l.trim() !== '')) {
    const match = /^\s*('?[\w-]+'?)(\??):\s*(.+?)\s*$/.exec(line)
    expect(match, `unreadable line in ${type}: "${line.trim()}"`).not.toBeNull()
    found.set(match![1].replaceAll("'", ''), `${match![2]}:${match![3]}`)
  }
  return found
}

describe.skipIf(!existsSync(join(REPO, BOARD.dir)) || !existsSync(join(REPO, PICKER.dir)))(
  'author picker contract: board → author-profile',
  () => {
    it('the picker accepts exactly what the board hands it (same names, optionality and types)', () => {
      const board = props(BOARD)
      const picker = props(PICKER)
      expect(board.size).toBeGreaterThan(5)
      expect(Object.fromEntries(picker)).toEqual(Object.fromEntries(board))
    })
  },
)
