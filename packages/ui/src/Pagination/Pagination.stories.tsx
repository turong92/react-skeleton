import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn } from 'storybook/test'
import { Pagination } from './Pagination'
import { paginationItems } from './paginationItems'

/**
 * 쪽 이동. `page` 는 백엔드 `PaginationMeta.page` 처럼 0 부터이고 화면에는 1 부터 보인다 — `onPageChange` 도 0 기반.
 * 한 쪽뿐이면 아무것도 그리지 않는다. 문구는 모두 prop(기본 영어).
 */
const meta = {
  title: 'UI/Pagination',
  component: Pagination,
  args: { page: 0, totalPages: 10, onPageChange: fn() },
} satisfies Meta<typeof Pagination>
export default meta
type Story = StoryObj<typeof meta>

export const FirstPage: Story = {
  play: async ({ canvas, args, userEvent }) => {
    // 처음 쪽: 이전 버튼이 막히고 1쪽이 현재 쪽
    await expect(canvas.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Page 1' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Next page' }))
    await expect(args.onPageChange).toHaveBeenCalledWith(1)
  },
}

export const MiddlePage: Story = {
  args: { page: 5 },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('button', { name: 'Page 6' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    // 처음 · 끝 쪽은 늘 보이고 사이는 …로 줄인다
    await expect(canvas.getByRole('button', { name: 'Page 1' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Page 10' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Page 3' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Previous page' }))
    await expect(args.onPageChange).toHaveBeenLastCalledWith(4)
    await userEvent.click(canvas.getByRole('button', { name: 'Page 10' }))
    await expect(args.onPageChange).toHaveBeenLastCalledWith(9)
  },
}

export const LastPage: Story = {
  args: { page: 9 },
  play: async ({ canvas, args, userEvent }) => {
    // 끝 쪽: 다음 버튼이 막힌다
    const next = canvas.getByRole('button', { name: 'Next page' })
    await expect(next).toBeDisabled()
    await userEvent.click(next)
    await expect(args.onPageChange).not.toHaveBeenCalled()
    await expect(canvas.getByRole('button', { name: 'Page 10' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  },
}

export const SinglePageRendersNothing: Story = {
  args: { totalPages: 1 },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('navigation')).toBeNull()
  },
}

export const FewPages: Story = {
  args: { totalPages: 3, page: 1 },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('button')).toHaveLength(5) // ‹ 1 2 3 ›
  },
}

export const KeyboardOperation: Story = {
  args: { page: 2 },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.tab()
    const previous = canvas.getByRole('button', { name: 'Previous page' })
    await expect(previous).toHaveFocus()
    await expect(getComputedStyle(previous).outlineStyle).toBe('solid')
    await userEvent.keyboard('{Enter}')
    await expect(args.onPageChange).toHaveBeenCalledWith(1)
  },
}

export const CustomLabels: Story = {
  args: {
    label: '쪽 이동',
    previousLabel: '이전 쪽',
    nextLabel: '다음 쪽',
    pageLabel: (n) => `${n}쪽`,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('navigation', { name: '쪽 이동' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: '1쪽' })).toBeVisible()
  },
}

function Demo() {
  const [page, setPage] = useState(0)
  return (
    <>
      <p>Page index: {page}</p>
      <Pagination page={page} totalPages={20} onPageChange={setPage} />
    </>
  )
}

export const Controlled: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Next page' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Next page' }))
    await expect(canvas.getByText('Page index: 2')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Page 3' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  },
}

/** `paginationItems` — 보일 번호 줄의 규칙(처음 · 끝 · 현재 ± siblings, 사이가 비면 gap) */
export const PaginationItemsRule: Story = {
  render: () => <p>paginationItems(page, totalPages, siblings)</p>,
  play: async () => {
    await expect(paginationItems(0, 3)).toEqual([0, 1, 2])
    await expect(paginationItems(5, 10)).toEqual([0, 'gap', 4, 5, 6, 'gap', 9])
    await expect(paginationItems(3, 10)).toEqual([0, 1, 2, 3, 4, 'gap', 9])
    await expect(paginationItems(99, 10).at(-1)).toBe(9)
    await expect(paginationItems(0, 0)).toEqual([])
  },
}
