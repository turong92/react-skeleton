import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/*
 * 경계 규칙 — 패키지는 서로를 이름(`@skeleton/<이름>`)으로만 부르고 그 barrel(src/index.ts)과 package.json `exports` 에 적힌
 * 하위 경로(`@skeleton/tokens/tokens.css`, `@skeleton/theme/vite` …)만 쓴다. 안쪽(`src/**`)으로 파고들면 그 패키지를 복사해 가거나
 * 내부를 고치는 순간 깨진다. 그리고 아무도 앱 코드를 import 하지 않는다(패키지는 앱을 모른다, 앱은 서로를 모른다).
 * 같은 폴더 안의 상대 경로 import 는 건드리지 않는다. 폴더를 벗어나는 상대 import 는 tests/workspace.test.ts 가 잡는다.
 */
const DEEP_IMPORT = {
  group: ['@skeleton/*/src', '@skeleton/*/src/**'],
  message:
    'Deep import into another package: import from its barrel (`@skeleton/<name>`) or a documented subpath export instead.',
}
const APP_CODE = {
  group: ['**/apps/**'],
  message: 'Never import app code — apps are copied, packages must not know them.',
}
const OTHER_PACKAGE_PATH = {
  group: ['**/packages/**'],
  message: 'Import another package by its name (`@skeleton/<name>`), not by relative path.',
}
const APP_NAMES = {
  group: ['workbench', 'workbench/**', 'starter', 'starter/**'],
  message: 'Packages must not import apps.',
}

export default defineConfig([
  globalIgnores(['**/dist', '**/node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['apps/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [DEEP_IMPORT, APP_CODE, OTHER_PACKAGE_PATH] }],
    },
  },
  {
    files: ['packages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [DEEP_IMPORT, APP_CODE, OTHER_PACKAGE_PATH, APP_NAMES] },
      ],
    },
  },
])
