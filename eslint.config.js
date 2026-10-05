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
  group: [
    'workbench',
    'workbench/**',
    'storybook-app',
    'storybook-app/**',
    'starter',
    'starter/**',
    'starter-ssr',
    'starter-ssr/**',
  ],
  message: 'Packages must not import apps.',
}

/*
 * 화면 코드는 @skeleton/ui 로 짠다 — 앱(apps/**)에서 날 <button> · <input> · <select> · <textarea> · <dialog> 와 인라인 style 의 색 · 간격 날값을 막는다.
 * 부품 안쪽(packages/ui)과 다른 패키지는 이 규칙 밖이다.
 * 예외 앱은 아래 UI_ONLY_EXEMPT 한 줄 — 이 레포에서는 워크벤치(날 요소 13곳 · 인라인 style 1곳이 토큰 · 부품 이전부터 쌓인 시각적 테스트 벤치의 모양이다).
 */
const UI_ONLY_EXEMPT = ['apps/workbench/**']
const STORY_HINT = ' — see its story for the canonical usage (docs/ui-catalog.md)'
const RAW_ELEMENT = (name, use) => ({
  selector: `JSXOpeningElement[name.name='${name}']`,
  message: `Raw <${name}> in app code: ${use} (from '@skeleton/ui')${STORY_HINT}.`,
})
const STYLE_KEYS =
  'color|background|backgroundColor|borderColor|outlineColor|fill|stroke|boxShadow|margin|marginTop|marginRight|marginBottom|marginLeft|marginInline|marginBlock|padding|paddingTop|paddingRight|paddingBottom|paddingLeft|paddingInline|paddingBlock|gap|rowGap|columnGap|borderRadius|fontSize'
const KEEP = '[\'"]?(var\\(|0[\'"]?$|auto|none|inherit|initial|unset|currentColor|transparent)'
const UI_ONLY = [
  RAW_ELEMENT('button', 'use <Button>'),
  RAW_ELEMENT('input', 'use <Input> inside <Field> (or <Checkbox> / <Switch> for checkboxes)'),
  RAW_ELEMENT('select', 'use <Select> inside <Field>'),
  RAW_ELEMENT('textarea', 'use <Textarea> inside <Field>'),
  RAW_ELEMENT('dialog', 'use <Dialog>'),
  {
    selector: `JSXAttribute[name.name='style'] ObjectExpression > Property[key.name=/^(${STYLE_KEYS})$/][value.type='Literal'][value.raw=/^(?!${KEEP})/]`,
    message:
      'Inline style colour / spacing literal: use a semantic token, e.g. style={{ color: "var(--text-muted)", padding: "var(--space-md)" }}, or a CSS module (docs/design-tokens.md).',
  },
]

export default defineConfig([
  globalIgnores(['**/dist', '**/node_modules', '**/storybook-static']),
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
    files: ['apps/**/*.{ts,tsx}'],
    ignores: UI_ONLY_EXEMPT,
    rules: { 'no-restricted-syntax': ['error', ...UI_ONLY] },
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
