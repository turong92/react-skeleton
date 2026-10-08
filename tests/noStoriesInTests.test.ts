import { describe, expect, it } from 'vitest'
import { loadWorkspaces } from './support/loadWorkspaces'

/*
 * `new-project.sh --without-storybook` 는 스토리와 `src/stories/` 를 지운다. 스토리 밖의 테스트가 거기서 import 하면 그렇게 찍은 프로젝트의 typecheck 가 깨진다 -
 * 테스트가 쓰는 가짜는 `src/test/` 에 둔다.
 */
describe('tests outside the stories', () => {
  it('do not import from a stories/ folder (it is removed by --without-storybook)', () => {
    const offenders: string[] = []
    for (const ws of loadWorkspaces())
      for (const file of ws.files) {
        const isTest = /\.test\.tsx?$/.test(file.path)
        const isStoryCode = /(^|\/)stories\//.test(file.path) || /\.stories\.tsx?$/.test(file.path)
        if (isTest && !isStoryCode && /from\s+['"][^'"]*\/stories\//.test(file.text))
          offenders.push(`${ws.dir}/${file.path}`)
      }
    expect(offenders).toEqual([])
  })
})
