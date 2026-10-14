import { describe, expect, it } from 'vitest'
import { assertProjectBuildEnv } from './projectBuild.ts'

/*
 * 프로젝트별 정적 빌드(`vite build --mode <프로젝트>`) 의 안전장치. 정적 호스트(Pages)에는 `/api/v1` 이 없다 —
 * API 주소를 빠뜨린 채 올리면 모든 호출이 호스트의 HTML 404 로 가므로 빌드에서 막는다. 기본 빌드(production)는 건드리지 않는다.
 */
describe('assertProjectBuildEnv', () => {
  it('leaves the default builds alone (no project config → exactly as before)', () => {
    expect(() => assertProjectBuildEnv('production', 'build', {})).not.toThrow()
    expect(() => assertProjectBuildEnv('development', 'serve', {})).not.toThrow()
    expect(() => assertProjectBuildEnv('a', 'serve', {})).not.toThrow()
  })

  it('refuses a project build without an absolute API address', () => {
    expect(() => assertProjectBuildEnv('a', 'build', {})).toThrow(/VITE_API_BASE_URL/)
    expect(() => assertProjectBuildEnv('a', 'build', { VITE_API_BASE_URL: '/api/v1' })).toThrow(
      /VITE_API_BASE_URL/,
    )
  })

  it('accepts a project build with an absolute http(s) API address', () => {
    expect(() =>
      assertProjectBuildEnv('a', 'build', {
        VITE_API_BASE_URL: 'https://api.a.example.com/api/v1',
      }),
    ).not.toThrow()
  })

  it('refuses a project name that cannot be a folder / host label', () => {
    const env = { VITE_API_BASE_URL: 'https://api.a.example.com/api/v1' }
    expect(() => assertProjectBuildEnv('A b', 'build', env)).toThrow(/project name/)
    expect(() => assertProjectBuildEnv('../x', 'build', env)).toThrow(/project name/)
  })
})
