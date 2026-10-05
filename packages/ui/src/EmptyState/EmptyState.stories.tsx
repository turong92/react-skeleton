import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { Button } from '../Button/Button'
import { EmptyState } from './EmptyState'

/** 비어 있는 목록 · 표 · 검색 결과 자리. 제목 단계(`headingLevel`)는 페이지 개요에 맞추고, 다음에 할 일은 `action` 에 `<Button>` 으로. */
const meta = {
  title: 'UI/EmptyState',
  component: EmptyState,
  args: { title: 'No projects yet' },
} satisfies Meta<typeof EmptyState>
export default meta
type Story = StoryObj<typeof meta>

export const TitleOnly: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 3, name: 'No projects yet' })).toBeVisible()
  },
}

export const WithDescriptionAndAction: Story = {
  args: {
    description: 'Projects you create will show up here.',
    action: <Button onClick={fn()}>Create project</Button>,
  },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText('Projects you create will show up here.')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Create project' }))
  },
}

export const WithIcon: Story = {
  args: { icon: <span>☁</span>, description: 'Nothing synced yet.' },
  play: async ({ canvas, canvasElement }) => {
    // 아이콘은 장식이라 낭독기에서 숨는다
    await expect(canvasElement.querySelector('[aria-hidden="true"]')).toHaveTextContent('☁')
    await expect(canvas.getByRole('heading')).toHaveAccessibleName('No projects yet')
  },
}

export const HeadingLevel: Story = {
  args: { headingLevel: 2 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 2 })).toBeVisible()
  },
}

export const LongText: Story = {
  args: {
    title: 'There is absolutely nothing here and there has never been anything here at all',
    description: 'A long description. '.repeat(20),
  },
  render: (args) => (
    <div style={{ maxWidth: '20rem' }}>
      <EmptyState {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    await expect(canvas.getByRole('heading')).toBeVisible()
  },
}
