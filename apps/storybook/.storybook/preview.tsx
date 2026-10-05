import type { Decorator, Preview } from '@storybook/react-vite'
import { configure } from 'storybook/test'
import '@skeleton/tokens/tokens.css'
import '@skeleton/ui/base.css'

/*
 * 모든 스토리 공통: 토큰 · 기본 요소 스타일을 싣고, 도구 모음의 라이트/다크 스위치를 앱과 같은 방법(`<html data-theme>`)으로 건다.
 * a11y 위반은 테스트 실행(pnpm test:stories)을 실패시킨다 — 끄는 규칙은 스토리 옆에 이유와 함께 적는다.
 */
// `findBy*` · `waitFor` 의 기본 1초는 CI 의 차가운 첫 렌더(브라우저 · 번들 예열)에서 가끔 모자란다 — 느린 곳에서만 길어지고 빠른 곳은 그대로 빠르다
configure({ asyncUtilTimeout: 5000 })

const THEMES = ['light', 'dark'] as const

const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme === 'dark' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', theme)
  return <Story />
}

const preview: Preview = {
  tags: ['autodocs'],
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: 'Colour theme (<html data-theme>)',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: THEMES.map((value) => ({ value, title: value })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
}
export default preview
