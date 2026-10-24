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
    const offenders = sources(join(__dirname)).filter((file) =>
      /['"](ADMIN|MODERATOR)['"]/.test(readFileSync(file, 'utf8')),
    )
    expect(offenders).toEqual([])
  })
})
