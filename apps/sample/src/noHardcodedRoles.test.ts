import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('operator screens decide by permission, not by role name', () => {
  it('no source file under src quotes a role name as a string', () => {
    // 역할 부여 화면의 `assignableRoles` 는 역할 관리 화면(R2)이 서버 목록으로 바꾼다 - 그 한 파일만 예외
    const allowed = ['AdminAccountsPage.tsx']
    const offenders = sources(join(__dirname))
      .filter((file) => !allowed.some((name) => file.endsWith(name)))
      .filter((file) => /['"](ADMIN|MODERATOR)['"]/.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
