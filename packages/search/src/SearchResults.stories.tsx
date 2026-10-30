import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'
import { koSearchLabels } from './labels'
import { SearchResults } from './SearchResults'
import { createFakeSearch, fail } from './stories/fakeSearch'
import { describeDemo } from './stories/describeDemo'
import { WithQuery } from './stories/WithQuery'

/**
 * 검색 결과 - 종류 칩(거르기, 눌린 칩은 ✓) · 「결과 N개」 · 제목 링크 + 발췌(일치한 곳은 `<mark>`) · 쪽 이동.
 * 2글자 미만이면 서버에 묻지 않고 「2글자 이상 입력해 주세요」만. 빈 · 로딩 · 오류(다시 시도)도 그린다.
 * 종류 이름과 링크는 앱이 `describe(type)` 로 준다 - 패키지는 노트 · 상품을 모른다. 제목 · 발췌는 글자로만 그린다(HTML 아님).
 */
const meta = {
  title: 'Packages/search/SearchResults',
  component: SearchResults,
  parameters: { layout: 'padded' },
  args: {
    api: createFakeSearch().api,
    query: '방끈',
    describe: describeDemo,
    types: ['note', 'product'],
    labels: koSearchLabels,
  },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof SearchResults>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    const link = await canvas.findByRole('link', { name: '여름 가방끈 수선 메모' })
    await expect(link).toHaveAttribute('href', '/notes/n1')
    await expect(canvas.getByText('결과 2개')).toBeVisible()
    const marks = canvas.getAllByText('방끈', { selector: 'mark' })
    await expect(marks.length).toBeGreaterThanOrEqual(2)
    await expect(canvas.getByRole('button', { name: '✓ 전체' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  },
}

export const TooShortDoesNotAsk: Story = {
  args: { query: '가' },
  render: (args) => {
    const fake = createFakeSearch()
    return <SearchResults {...args} api={fake.api} />
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('2글자 이상 입력해 주세요.')).toBeVisible()
    await expect(canvas.queryByRole('link')).toBeNull()
  },
}

export const Empty: Story = {
  args: { query: '없는낱말' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('「없는낱말」에 맞는 결과가 없어요')).toBeVisible()
  },
}

export const TypeChipNarrowsAndGoesBackToPageOne: Story = {
  args: { query: '메모', pageSize: 2 },
  render: (args) => {
    const fake = createFakeSearch()
    return <SearchResults {...args} api={fake.api} />
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findAllByRole('link')
    await userEvent.click(canvas.getByRole('button', { name: '2쪽' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: '2쪽' })).toHaveAttribute('aria-current', 'page'),
    )
    const chip = canvas.getByRole('button', { name: '상품' })
    await expect(chip).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(chip)
    await expect(await canvas.findByRole('button', { name: '✓ 상품' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(canvas.getByRole('button', { name: '전체' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    // 상품에는 「메모」가 없다 - 거른 결과가 비고, 쪽은 첫 쪽으로 돌아갔다
    await expect(await canvas.findByText('「메모」에 맞는 결과가 없어요')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '✓ 상품' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: '1쪽' })).toHaveAttribute('aria-current', 'page'),
    )
  },
}

export const PagesThroughResults: Story = {
  args: { query: '회의록', pageSize: 10 },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByRole('link', { name: '회의록 1' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '2쪽' }))
    await expect(await canvas.findByRole('link', { name: '회의록 11' })).toBeVisible()
    await expect(canvas.queryByRole('link', { name: '회의록 1' })).toBeNull()
  },
}

export const DrawsMarkupAsText: Story = {
  args: { query: '메모', types: ['note'] },
  render: (args) => {
    const fake = createFakeSearch()
    return <SearchResults {...args} api={fake.api} pageSize={30} />
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByText(/alert\(1\)<\/script>/)).toBeVisible()
    await expect(canvasElement.querySelector('script')).toBeNull()
    await expect(canvasElement.querySelector('img')).toBeNull()
  },
}

export const Failed: Story = {
  args: {
    api: createFakeSearch(undefined, { failWith: fail(500, 'COMMON.INTERNAL_SERVER_ERROR') }).api,
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('검색하지 못했어요. 다시 시도해 주세요.')).toBeVisible()
    await expect(canvas.getByRole('button', { name: '다시 시도' })).toBeVisible()
  },
}

export const Loading: Story = {
  args: { api: createFakeSearch(undefined, { delayMs: 60_000 }).api },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('검색하는 중')).toBeInTheDocument()
  },
}
