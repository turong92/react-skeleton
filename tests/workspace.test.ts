/// <reference types="node" />
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadWorkspaces, REPO } from './support/loadWorkspaces'
import { findProblems } from './support/workspaceRules'

/*
 * 이 레포의 앱 · 패키지가 지켜야 하는 모양. 규칙 자체의 테스트는 workspaceRules.test.ts.
 * 패키지를 지우거나 packages/<이름> 폴더를 다른 프로젝트로 복사해 갈 수 있으려면 —
 * 선언한 @skeleton 의존 = 실제로 import 하는 것, 그리고 패키지 이름으로만 서로를 부른다.
 */
const workspaces = loadWorkspaces()
const packages = workspaces.filter((w) => w.kind === 'package')
const apps = workspaces.filter((w) => w.kind === 'app')

describe('the workspace', () => {
  it('every app and package declares exactly the @skeleton packages its source imports (removable)', () => {
    expect(findProblems(workspaces)).toEqual([])
  })

  it('an app that is not the workbench does not depend on workbench code (the starter is copied without it)', () => {
    for (const app of apps.filter((w) => w.dir !== 'apps/workbench')) {
      expect(JSON.stringify(app.packageJson), app.dir).not.toContain('workbench')
      for (const file of app.files)
        expect(file.text, `${app.dir}/${file.path}`).not.toMatch(/workbench/i)
    }
  })

  it('no package depends on an app, and apps depend on no other app', () => {
    const appNames = apps.map((w) => w.packageJson.name)
    for (const ws of workspaces) {
      const declared = Object.keys({
        ...ws.packageJson.dependencies,
        ...ws.packageJson.devDependencies,
        ...ws.packageJson.peerDependencies,
      })
      expect(
        declared.filter((dep) => appNames.includes(dep)),
        ws.dir,
      ).toEqual([])
    }
  })
})

describe.each(packages.map((w) => [w.dir, w] as const))('%s is self-contained', (dir, ws) => {
  const { name, exports, scripts } = ws.packageJson as unknown as {
    name: string
    exports: Record<string, unknown>
    scripts: Record<string, string>
  }

  it('is named @skeleton/<folder> and exposes its source barrel (or documented assets) through exports', () => {
    expect(name).toBe(`@skeleton/${dir.split('/')[1]}`)
    expect(exports['.']).toEqual({ types: './src/index.ts', default: './src/index.ts' })
  })

  it('has its own tests, typecheck, README and tsconfig', () => {
    expect(scripts.test).toBeTruthy()
    expect(scripts.typecheck).toBeTruthy()
    expect(existsSync(join(REPO, dir, 'README.md')), 'README.md').toBe(true)
    expect(existsSync(join(REPO, dir, 'tsconfig.json')), 'tsconfig.json').toBe(true)
    expect(
      ws.files.some((file) => /\.test\.[cm]?[jt]sx?$/.test(file.path)),
      'at least one test file',
    ).toBe(true)
  })
})

describe.each(apps.map((w) => [w.dir, w] as const))('%s', (dir, ws) => {
  it('has its own typecheck, test and build scripts and runs the Vite theme pre-paint plugin', () => {
    const { scripts } = ws.packageJson as unknown as { scripts: Record<string, string> }
    expect(scripts.typecheck).toBeTruthy()
    expect(scripts.test).toBeTruthy()
    expect(scripts.build).toContain('vite build')
    const config = ws.files.find((file) => file.path === 'vite.config.ts')
    expect(config?.text, `${dir}/vite.config.ts`).toContain('themePrePaint()')
  })
})
