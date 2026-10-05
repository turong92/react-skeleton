/// <reference types="node" />
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Catalog } from '../../scripts/capabilities.d/lib.mjs'

/*
 * 가짜 작은 레포 하나(패키지 둘 · 앱 하나 · 문서 · 스토리 · 스크립트)와 그것에 꼭 맞는 카탈로그.
 * 카탈로그 가드(scripts/capabilities.d/*.mjs)가 어긋남을 정말 잡는지 — 한 곳씩 망가뜨려 — 보려고 쓴다.
 */
export type Json = Record<string, unknown>

const put = (root: string, path: string, text: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), text)
}
const putJson = (root: string, path: string, value: unknown) =>
  put(root, path, `${JSON.stringify(value, null, 2)}\n`)

export function makeFixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'capabilities-fixture-'))
  putJson(root, 'packages/alpha/package.json', {
    name: '@skeleton/alpha',
    version: '1.0.0',
    exports: {
      '.': { types: './src/index.ts', default: './src/index.ts' },
      './vite': './src/vite.ts',
    },
    dependencies: { '@skeleton/beta': 'workspace:*' },
  })
  put(
    root,
    'packages/alpha/src/index.ts',
    [
      "export { makeAlpha, type AlphaOptions } from './a'",
      "export type { AlphaProps } from './a'",
      'export function useAlpha() {}',
      'export const ALPHA_KEY = 1',
      '',
    ].join('\n'),
  )
  put(root, 'packages/alpha/src/vite.ts', 'export function alphaFiles() {}\n')
  put(root, 'packages/alpha/README.md', '# alpha\n')
  put(root, 'packages/alpha/src/Alpha.stories.tsx', 'export default {}\n')
  putJson(root, 'packages/beta/package.json', {
    name: '@skeleton/beta',
    version: '1.0.0',
    exports: { '.': { types: './src/index.ts', default: './src/index.ts' } },
  })
  put(root, 'packages/beta/src/index.ts', 'export const beta = 1\n')
  putJson(root, 'apps/web/package.json', { name: 'web', version: '1.0.0' })
  put(root, 'apps/web/src/main.tsx', 'export {}\n')
  put(root, 'docs/guide.md', '# guide\n')
  put(root, 'scripts/tool.sh', '#!/usr/bin/env bash\n')
  putJson(root, 'capabilities.json', fixtureCatalog())
  return root
}

const keywords = { ko: ['알파'], en: ['alpha'] }
const none = { flag: null, included: 'always', autoIncludes: [], alsoVia: [], optOut: null }

export const entry = (over: Json): Json => ({
  id: 'x',
  kind: 'package',
  summary: 'One sentence.',
  package: null,
  path: 'scripts/tool.sh',
  status: 'stable',
  stampFlag: none,
  needs: [],
  backend: null,
  entryPoints: [],
  stories: [],
  patterns: [],
  docs: [],
  notFor: ['nothing'],
  keywords,
  ...over,
})

export function fixtureCatalog(): Catalog {
  return {
    schemaVersion: 1,
    mode: 'skeleton',
    name: 'fixture-skeleton',
    scope: '@skeleton',
    version: '1.0.0',
    summary: 'A fixture.',
    capabilities: [
      entry({
        id: 'alpha',
        kind: 'package',
        summary: 'Alpha does things.',
        package: '@skeleton/alpha',
        path: 'packages/alpha',
        stampFlag: { ...none, flag: '--packages alpha', included: 'flag', autoIncludes: ['beta'] },
        needs: ['beta'],
        backend: {
          modules: ['alpha-mod'],
          oneOfModules: [],
          optionalModules: [],
          basePaths: ['/api/v1/alpha'],
          docs: ['docs/modules/alpha-mod.md'],
        },
        entryPoints: [
          'makeAlpha',
          'AlphaOptions',
          'useAlpha',
          'ALPHA_KEY',
          '@skeleton/alpha/vite#alphaFiles',
        ],
        stories: ['packages/alpha/src/Alpha.stories.tsx'],
        docs: ['packages/alpha/README.md', 'docs/guide.md'],
      }),
      entry({
        id: 'beta',
        kind: 'package',
        summary: 'Beta is shared.',
        package: '@skeleton/beta',
        path: 'packages/beta',
        entryPoints: ['beta'],
      }),
      entry({
        id: 'app-web',
        kind: 'app',
        summary: 'The web app.',
        package: 'web',
        path: 'apps/web',
        entryPoints: ['apps/web/src/main.tsx'],
      }),
      entry({
        id: 'script-tool',
        kind: 'script',
        summary: 'A tool.',
        path: 'scripts/tool.sh',
        stampFlag: { ...none, included: 'never' },
      }),
    ],
  }
}
