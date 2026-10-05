import type { StorybookConfig } from '@storybook/react-vite'

/*
 * 스토리는 부품 옆에 둔다(packages/<이름>/src/**\/*.stories.tsx) — 패키지를 지우면 스토리도 같이 간다.
 * 이 앱(apps/storybook)이 가진 것은 설정 · Patterns(@skeleton/ui 만으로 짠 화면 틀) · 토큰 문서다.
 */
const config: StorybookConfig = {
  stories: ['../../../packages/*/src/**/*.stories.@(ts|tsx)', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: '@storybook/react-vite',
  core: { disableTelemetry: true },
}
export default config
