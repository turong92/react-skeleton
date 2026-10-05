/// <reference types="node" />
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import { REPO } from './support/loadWorkspaces'

/*
 * eslint.config.js 의 경계 규칙: 패키지 안쪽(@skeleton/<이름>/src/**)으로 파고드는 import 금지,
 * 패키지 · 앱이 다른 앱의 코드를 import 금지(패키지는 앱을 몰라야 한다).
 */
const eslint = new ESLint({ cwd: REPO })

async function lint(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath: `${REPO}${filePath}` })
  return result.messages.filter((m) => m.ruleId === 'no-restricted-imports').map((m) => m.message)
}

/** 위반이 난 줄 번호(한 import 가 여러 패턴에 걸려도 한 번) */
async function linesOf(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath: `${REPO}${filePath}` })
  return [
    ...new Set(
      result.messages.filter((m) => m.ruleId === 'no-restricted-imports').map((m) => m.line),
    ),
  ]
}

describe('import boundaries (no-restricted-imports)', () => {
  it('forbids deep imports into another package from an app', async () => {
    const messages = await lint(
      'apps/starter/src/x.ts',
      "import { createApiClient } from '@skeleton/api-client/src/createApiClient'\nexport { createApiClient }\n",
    )
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatch(/barrel|src/i)
  })

  it('forbids deep imports from a package too, including the bare src folder', async () => {
    expect(
      await lint(
        'packages/auth/src/x.ts',
        "import { a } from '@skeleton/api-client/src/types'\nimport { b } from '@skeleton/api-client/src'\nexport { a, b }\n",
      ),
    ).toHaveLength(2)
  })

  it('allows the package barrel and the documented subpath exports', async () => {
    expect(
      await lint(
        'apps/starter/src/x.ts',
        [
          "import { createApiClient } from '@skeleton/api-client'",
          "import { themePrePaint } from '@skeleton/theme/vite'",
          "import '@skeleton/tokens/tokens.css'",
          "import '@skeleton/ui/base.css'",
          'export { createApiClient, themePrePaint }',
          '',
        ].join('\n'),
      ),
    ).toEqual([])
  })

  it('forbids a package from importing app code, by path or by name', async () => {
    const lines = await linesOf(
      'packages/ui/src/x.ts',
      [
        "import { a } from '../../../apps/workbench/src/api/client'",
        "import { b } from 'workbench'",
        "import { c } from 'starter/src/main'",
        'export { a, b, c }',
        '',
      ].join('\n'),
    )
    expect(lines).toEqual([1, 2, 3])
  })

  it('forbids an app from importing another app', async () => {
    expect(
      await lint(
        'apps/starter/src/x.ts',
        "import { a } from '../../../apps/workbench/src/api/client'\nexport { a }\n",
      ),
    ).toHaveLength(1)
  })

  it('does not bother files inside the same package or app', async () => {
    expect(
      await lint(
        'packages/ui/src/Button/x.ts',
        "import { a } from '../Input/Input'\nexport { a }\n",
      ),
    ).toEqual([])
  })
})
