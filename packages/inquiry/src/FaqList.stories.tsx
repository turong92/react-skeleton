import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { FaqDemo } from './stories/Demos'

/**
 * 자주 묻는 질문 접기 목록 — 갈래 제목(h2) 아래 질문마다 네이티브 `<details>` 한 줄. 처음엔 모두 접혀 있고 눌러서(Enter · Space 도) 답을 편다.
 * 질문 · 답은 앱이 정한다 — 이 부품은 문구를 모른다.
 */
const meta = {
  title: 'Packages/inquiry/FaqList',
  component: FaqDemo,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof FaqDemo>
export default meta
type Story = StoryObj<typeof meta>

export const OpensAnAnswerOnPress: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('heading', { name: '시작하기' })).toBeVisible()
    await expect(canvas.getByText('기본 기능은 무료예요.')).not.toBeVisible()
    await userEvent.click(canvas.getByText('무료인가요?'))
    await expect(canvas.getByText('기본 기능은 무료예요.')).toBeVisible()
    await userEvent.click(canvas.getByText('무료인가요?'))
    await expect(canvas.getByText('기본 기능은 무료예요.')).not.toBeVisible()
  },
}
