/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { WorkspaceInput } from './workspaceRules'

export const REPO = fileURLToPath(new URL('../../', import.meta.url))

const SKIP = new Set(['node_modules', 'dist', 'storybook-static', '.tmp'])
const SOURCE = /\.(?:[cm]?[jt]sx?|css|html)$/

export function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return []
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

/** `apps/*` + `packages/*` 를 읽어 규칙 입력으로 바꾼다 */
export function loadWorkspaces(): WorkspaceInput[] {
  return (['apps', 'packages'] as const).flatMap((group) =>
    readdirSync(join(REPO, group))
      .filter((name) => statSync(join(REPO, group, name)).isDirectory())
      .map((name): WorkspaceInput => {
        const dir = `${group}/${name}`
        const root = join(REPO, dir)
        return {
          dir,
          kind: group === 'apps' ? 'app' : 'package',
          packageJson: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')),
          files: walk(root)
            .filter((file) => SOURCE.test(file))
            .map((file) => ({ path: relative(root, file), text: readFileSync(file, 'utf8') })),
        }
      }),
  )
}
