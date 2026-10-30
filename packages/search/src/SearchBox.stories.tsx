import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { koSearchLabels } from './labels'
import { SearchBox } from './SearchBox'

/**
 * 검색 입력 - `Input`(검색) + 「검색」 단추를 `role="search"` 로 묶었다. Enter 나 단추로 제출하면 앞뒤 공백을 뗀 글자를 `onSearch` 로 건넨다.
 * 비어 있으면 아무 일도 없다. 한 글자도 그대로 건넨다 - 「2글자 이상」 안내는 결과 화면이 한다. 이동은 앱의 몫(견본은 `/search?q=` 로).
 */
const meta = {
  title: 'Packages/search/SearchBox',
  component: SearchBox,
  parameters: { layout: 'padded' },
  args: { labels: koSearchLabels, onSearch: fn() },
} satisfies Meta<typeof SearchBox>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const form = canvas.getByRole('search', { name: '검색' })
    await expect(form).toBeVisible()
    await userEvent.type(canvas.getByRole('searchbox', { name: '검색' }), '  가방끈 {Enter}')
    await expect(args.onSearch).toHaveBeenLastCalledWith('가방끈')
  },
}

export const SubmitButton: Story = {
  args: { defaultValue: '프로' },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('searchbox', { name: '검색' })).toHaveValue('프로')
    await userEvent.click(canvas.getByRole('button', { name: '검색' }))
    await expect(args.onSearch).toHaveBeenLastCalledWith('프로')
  },
}

export const EmptyDoesNothing: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByRole('searchbox', { name: '검색' }), '   {Enter}')
    await userEvent.click(canvas.getByRole('button', { name: '검색' }))
    await expect(args.onSearch).not.toHaveBeenCalled()
  },
}
