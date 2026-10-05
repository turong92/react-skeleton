import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { readSemanticTokens, THEME_NAMES } from './tokenData'
import { TokensPage } from './TokensPage'

/**
 * 디자인 토큰 — `packages/tokens/tokens.json`(정본)에서 읽은 의미 토큰의 색 · 간격 · 모서리 · 글자 크기 · 그림자. 라이트와 다크를 나란히,
 * 값은 그 테마에서 끝까지 푼 값이다. 화면 CSS · 인라인 style 에는 이 이름(`var(--space-md)` …)만 쓴다. 값을 바꾸는 법은 `docs/design-tokens.md`.
 */
const meta = {
  title: 'Design tokens/Tokens',
  component: TokensPage,
  tags: ['!autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof TokensPage>
export default meta
type Story = StoryObj<typeof meta>

export const Overview: Story = {
  play: async ({ canvas, canvasElement }) => {
    // 실제 tokens.json 의 모든 의미 토큰이 두 테마 패널에 한 번씩 그려진다
    const tokens = readSemanticTokens()
    await expect(canvasElement.querySelectorAll('[data-theme]')).toHaveLength(THEME_NAMES.length)
    await expect(canvas.getAllByText('--bg')).toHaveLength(THEME_NAMES.length)
    await expect(canvas.getAllByText('--space-md')).toHaveLength(THEME_NAMES.length)
    await expect(tokens.length).toBeGreaterThan(30)
    for (const heading of ['Colors', 'Spacing', 'Radius', 'Type scale', 'Shadows'])
      await expect(canvas.getAllByRole('heading', { name: heading })).toHaveLength(
        THEME_NAMES.length,
      )
  },
}
