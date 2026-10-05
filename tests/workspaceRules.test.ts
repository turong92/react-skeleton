import { describe, expect, it } from 'vitest'
import { findProblems, skeletonImportsOf, type WorkspaceInput } from './support/workspaceRules'

/*
 * 「패키지는 지울 수 있다」를 재는 규칙 자체의 테스트 — 작은 가짜 워크스페이스로 규칙마다 위반을 만들어 본다.
 * 실제 레포에 대한 검사는 workspace.test.ts.
 */
type Spec = {
  kind?: 'app' | 'package'
  name: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  files?: Record<string, string>
}

function workspace(spec: Spec): WorkspaceInput {
  const kind = spec.kind ?? 'package'
  return {
    dir: `${kind === 'app' ? 'apps' : 'packages'}/${spec.name.replace('@skeleton/', '')}`,
    kind,
    packageJson: {
      name: spec.name,
      dependencies: spec.dependencies,
      peerDependencies: spec.peerDependencies,
      devDependencies: spec.devDependencies,
    },
    files: Object.entries(spec.files ?? {}).map(([path, text]) => ({ path, text })),
  }
}

const ws = (...specs: Spec[]) => specs.map(workspace)
const WS = 'workspace:*'

describe('skeletonImportsOf', () => {
  it('finds static, type-only, re-export, dynamic and css imports of @skeleton packages', () => {
    const text = `
      import { a } from '@skeleton/one'
      import type { B } from "@skeleton/two/sub"
      export { c } from '@skeleton/three'
      const d = await import('@skeleton/four')
      import '@skeleton/five/styles.css'
      import {
        e,
      } from '@skeleton/six'
      import react from 'react'
    `
    expect(skeletonImportsOf(text).map((i) => i.specifier)).toEqual([
      '@skeleton/one',
      '@skeleton/two/sub',
      '@skeleton/three',
      '@skeleton/four',
      '@skeleton/five/styles.css',
      '@skeleton/six',
    ])
  })

  it('ignores imports that only appear in comments', () => {
    const text = `// import x from '@skeleton/ghost'\n/* import y from '@skeleton/ghost2' */\nconst real = 1`
    expect(skeletonImportsOf(text)).toEqual([])
  })
})

describe('findProblems', () => {
  const ui = { name: '@skeleton/ui', files: { 'src/a.ts': 'export const a = 1' } }
  const clean = ws(
    { name: '@skeleton/api-client' },
    {
      name: '@skeleton/auth',
      dependencies: { '@skeleton/api-client': WS },
      files: { 'src/a.ts': "import { x } from '@skeleton/api-client'" },
    },
    ui,
    {
      kind: 'app',
      name: 'starter',
      dependencies: { '@skeleton/auth': WS },
      files: { 'src/main.tsx': "import { y } from '@skeleton/auth'" },
    },
  )

  it('is empty when declared dependencies match the source imports exactly', () => {
    expect(findProblems(clean)).toEqual([])
  })

  it('flags an import that is not declared (the copy would not build)', () => {
    const broken = ws(
      { name: '@skeleton/api-client' },
      { name: '@skeleton/auth', files: { 'src/a.ts': "import '@skeleton/api-client'" } },
    )
    expect(findProblems(broken)).toEqual([
      expect.stringContaining(
        '@skeleton/auth imports @skeleton/api-client but does not declare it',
      ),
    ])
  })

  it('flags a declared dependency that the source never imports (the package could not be removed on its own)', () => {
    const broken = ws(
      { name: '@skeleton/api-client' },
      {
        name: '@skeleton/auth',
        dependencies: { '@skeleton/api-client': WS },
        files: { 'src/a.ts': 'export {}' },
      },
    )
    expect(findProblems(broken)).toEqual([
      expect.stringContaining('@skeleton/auth declares @skeleton/api-client but never imports it'),
    ])
  })

  it('counts a deep import (@skeleton/x/sub) as a use of @skeleton/x', () => {
    const fine = ws(
      { name: '@skeleton/tokens' },
      {
        kind: 'app',
        name: 'starter',
        dependencies: { '@skeleton/tokens': WS },
        files: { 'src/main.tsx': "import '@skeleton/tokens/tokens.css'" },
      },
    )
    expect(findProblems(fine)).toEqual([])
  })

  it('test files may use a package through devDependencies but do not count as a runtime use', () => {
    const fine = ws(
      { name: '@skeleton/api-client' },
      {
        name: '@skeleton/auth',
        devDependencies: { '@skeleton/api-client': WS },
        files: { 'src/a.test.ts': "import '@skeleton/api-client'" },
      },
    )
    expect(findProblems(fine)).toEqual([])
    const undeclared = ws(
      { name: '@skeleton/api-client' },
      { name: '@skeleton/auth', files: { 'src/a.test.ts': "import '@skeleton/api-client'" } },
    )
    expect(findProblems(undeclared)).toEqual([
      expect.stringContaining(
        '@skeleton/auth imports @skeleton/api-client but does not declare it',
      ),
    ])
  })

  it('stories (*.stories.tsx and src/stories/) are test-side files: they may use devDependencies and the Storybook toolchain from the root', () => {
    const fine = ws(
      { name: '@skeleton/ui' },
      {
        name: '@skeleton/auth',
        devDependencies: { '@skeleton/ui': WS },
        files: {
          'src/A.stories.tsx':
            "import type { Meta } from '@storybook/react-vite'\nimport { expect } from 'storybook/test'\nimport { Button } from '@skeleton/ui'",
          'src/stories/fakes.ts': "import '@skeleton/ui'",
        },
      },
    )
    expect(findProblems(fine)).toEqual([])
    const undeclared = ws(
      { name: '@skeleton/ui' },
      { name: '@skeleton/auth', files: { 'src/A.stories.tsx': "import '@skeleton/ui'" } },
    )
    expect(findProblems(undeclared)).toEqual([
      expect.stringContaining('@skeleton/auth imports @skeleton/ui but does not declare it'),
    ])
  })

  it('e2e files (an e2e/ folder) are test-side too: a browser driver from devDependencies is enough, not a runtime dependency', () => {
    const fine = ws({
      kind: 'app',
      name: 'sample',
      devDependencies: { playwright: '^1.63.0' },
      files: { 'e2e/helpers.ts': "import { chromium } from 'playwright'" },
    })
    expect(findProblems(fine)).toEqual([])
    const undeclared = ws({
      kind: 'app',
      name: 'sample',
      files: { 'e2e/helpers.ts': "import { chromium } from 'playwright'" },
    })
    expect(findProblems(undeclared)).toEqual([
      expect.stringContaining('sample imports playwright but does not declare it'),
    ])
  })

  it('the starter app must not depend on, or import, the workbench app', () => {
    const broken = ws(
      { kind: 'app', name: 'workbench' },
      {
        kind: 'app',
        name: 'starter',
        dependencies: { workbench: WS },
        files: { 'src/main.tsx': "import { x } from '../../workbench/src/y'" },
      },
    )
    const problems = findProblems(broken)
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('starter depends on the app workbench'),
        expect.stringContaining('starter imports outside its own folder'),
      ]),
    )
  })

  it('a package must not depend on an app', () => {
    const broken = ws(
      { kind: 'app', name: 'starter' },
      { name: '@skeleton/ui', dependencies: { starter: WS } },
    )
    expect(findProblems(broken)).toEqual(
      expect.arrayContaining([expect.stringContaining('@skeleton/ui depends on the app starter')]),
    )
  })

  it('flags a relative import that climbs out of the workspace folder', () => {
    const broken = ws({
      name: '@skeleton/ui',
      files: { 'src/Button/Button.tsx': "import { x } from '../../../auth/src/y'" },
    })
    expect(findProblems(broken)).toEqual([
      expect.stringContaining('@skeleton/ui imports outside its own folder'),
    ])
  })

  it('allows relative imports that stay inside the folder, also with ../', () => {
    const fine = ws({
      name: '@skeleton/ui',
      files: {
        'src/Button/Button.tsx': "import { x } from '../Input/Input'",
        'src/Input/Input.ts': '',
      },
    })
    expect(findProblems(fine)).toEqual([])
  })

  it('flags a deep import into another package source', () => {
    const broken = ws(
      { name: '@skeleton/api-client' },
      {
        name: '@skeleton/auth',
        dependencies: { '@skeleton/api-client': WS },
        files: { 'src/a.ts': "import { x } from '@skeleton/api-client/src/createApiClient'" },
      },
    )
    expect(findProblems(broken)).toEqual([
      expect.stringContaining('deep import @skeleton/api-client/src/createApiClient'),
    ])
  })

  it('flags a declared @skeleton dependency that is not workspace:* or does not exist', () => {
    const broken = ws({
      name: '@skeleton/auth',
      dependencies: { '@skeleton/ghost': '^1.0.0' },
      files: { 'src/a.ts': "import '@skeleton/ghost'" },
    })
    const problems = findProblems(broken)
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('@skeleton/ghost must be "workspace:*"'),
        expect.stringContaining('@skeleton/ghost is not a package in this workspace'),
      ]),
    )
  })

  it('flags a dependency cycle between packages', () => {
    const broken = ws(
      {
        name: '@skeleton/a',
        dependencies: { '@skeleton/b': WS },
        files: { 'src/x.ts': "import '@skeleton/b'" },
      },
      {
        name: '@skeleton/b',
        dependencies: { '@skeleton/a': WS },
        files: { 'src/x.ts': "import '@skeleton/a'" },
      },
    )
    expect(findProblems(broken)).toEqual(
      expect.arrayContaining([expect.stringContaining('dependency cycle')]),
    )
  })

  it('flags an external import that source does not declare (dependencies or peerDependencies)', () => {
    const broken = ws({
      name: '@skeleton/ui',
      files: { 'src/a.ts': "import { useState } from 'react'\nimport fs from 'node:fs'" },
    })
    expect(findProblems(broken)).toEqual([
      expect.stringContaining('@skeleton/ui imports react but does not declare it'),
    ])
    const fine = ws({
      name: '@skeleton/ui',
      peerDependencies: { react: '^19.0.0' },
      files: { 'src/a.ts': "import { useState } from 'react'\nimport fs from 'node:fs'" },
    })
    expect(findProblems(fine)).toEqual([])
  })

  it('treats subpath imports (react-dom/server, @scope/pkg/sub) as the package, and vitest as the toolchain for tests', () => {
    const fine = ws({
      name: '@skeleton/ui',
      devDependencies: { 'react-dom': '^19.0.0' },
      files: {
        'src/a.test.tsx':
          "import { renderToStaticMarkup } from 'react-dom/server'\nimport { it } from 'vitest'",
      },
    })
    expect(findProblems(fine)).toEqual([])
  })

  it('a package that reads import.meta.env is flagged (apps do the env wiring)', () => {
    const broken = ws({
      name: '@skeleton/api-client',
      files: { 'src/a.ts': 'export const dev = import.meta.env.DEV' },
    })
    expect(findProblems(broken)).toEqual([
      expect.stringContaining('@skeleton/api-client reads import.meta.env'),
    ])
    const app = ws({
      kind: 'app',
      name: 'starter',
      files: { 'src/a.ts': 'export const dev = import.meta.env.DEV' },
    })
    expect(findProblems(app)).toEqual([])
  })
})
