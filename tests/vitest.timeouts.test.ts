/// <reference types="node" />
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REPO } from './support/loadWorkspaces'

/*
 * vitest 의 기본 5 s(테스트) · 10 s(훅)는 부하가 큰 기계(load 수십)에서 import · 렌더가 무거운 테스트를 거짓으로 실패시킨다.
 * 시간 상한은 「멈춘 것을 끊는」 용도라 넉넉해야 하고(걸리는 만큼만 쓴다), 각 워크스페이스의 `test` 스크립트와 설정 파일에 한 번씩 적혀 있어야 한다 —
 * 찍힌 프로젝트는 이 파일과 package.json · 설정을 그대로 가져오므로 같은 값을 물려받고, 누가 지우면 이 테스트가 막는다.
 */
const MIN_TEST_MS = 30_000
const MIN_HOOK_MS = 60_000

const flagMs = (script: string, flag: string) => {
  const m = new RegExp(`--${flag}[ =](\\d+)`).exec(script)
  return m ? Number(m[1]) : 0
}

describe('slow-machine safe vitest timeouts', () => {
  const dirs = ['apps', 'packages'].flatMap((group) =>
    readdirSync(join(REPO, group))
      .map((name) => `${group}/${name}`)
      .filter((dir) => existsSync(join(REPO, dir, 'package.json'))),
  )
  it('finds the workspaces', () => expect(dirs.length).toBeGreaterThan(3))

  it.each(dirs)('%s: the test script raises the default timeouts', (dir) => {
    const manifest = JSON.parse(readFileSync(join(REPO, dir, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }
    const script = manifest.scripts?.test
    if (!script || !script.includes('vitest')) return
    expect(flagMs(script, 'testTimeout'), `${dir} --testTimeout`).toBeGreaterThanOrEqual(
      MIN_TEST_MS,
    )
    expect(flagMs(script, 'hookTimeout'), `${dir} --hookTimeout`).toBeGreaterThanOrEqual(
      MIN_HOOK_MS,
    )
  })

  it.each(['vitest.root.config.ts', 'apps/storybook/vitest.stories.config.ts'])(
    '%s sets testTimeout and hookTimeout',
    (file) => {
      const path = join(REPO, file)
      if (!existsSync(path)) return // 스토리집 없이 찍은 프로젝트
      const text = readFileSync(path, 'utf8')
      const ms = (key: string) =>
        Number((new RegExp(`${key}:\\s*([\\d_]+)`).exec(text)?.[1] ?? '0').replaceAll('_', ''))
      expect(ms('testTimeout')).toBeGreaterThanOrEqual(MIN_TEST_MS)
      expect(ms('hookTimeout')).toBeGreaterThanOrEqual(MIN_HOOK_MS)
    },
  )
})
