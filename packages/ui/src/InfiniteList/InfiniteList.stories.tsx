import type { Meta, StoryObj } from '@storybook/react-vite'
import { useCallback, useRef, useState } from 'react'
import { expect, waitFor } from 'storybook/test'
import { Card } from '../Card/Card'
import { InfiniteList } from './InfiniteList'

/**
 * 이어 보기 목록 — 끝 표지가 화면에 들어오면 자동으로 다음 쪽, 그리고 **언제나** 키보드로 누를 수 있는 「더 보기」 버튼.
 * 자동 불러오기는 편의일 뿐이다(`auto={false}` 면 버튼만). 실패하면 멈추고 「다시 시도」, 끝에 닿으면 끝 안내로 포커스를 옮긴다.
 * 데이터는 호출하는 쪽(보통 `useInfiniteQuery`)이 준다 — 이 스토리는 가짜 쪽 불러오기.
 */
const meta = {
  title: 'UI/InfiniteList',
  component: InfiniteList<number>,
  // 각 스토리는 자기 `render` 로 짠다(데이터는 가짜 쪽 불러오기) — 필수 props 만 채운 기본값
  args: {
    items: [],
    getKey: String,
    renderItem: () => null,
    hasMore: false,
    onLoadMore: () => undefined,
  },
} satisfies Meta<typeof InfiniteList<number>>
export default meta
type Story = StoryObj<typeof meta>

/** 쪽마다 3개, 전체 `total` 개. `failOnce` 면 두 번째 쪽이 한 번 실패한다 */
function usePages(total: number, failOnce = false) {
  const [count, setCount] = useState(3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const failed = useRef(false)
  const loadMore = useCallback(() => {
    setLoading(true)
    setError(false)
    setTimeout(() => {
      if (failOnce && !failed.current && count >= 3) {
        failed.current = true
        setError(true)
      } else setCount((value) => Math.min(total, value + 3))
      setLoading(false)
    }, 80)
  }, [count, failOnce, total])
  return {
    items: Array.from({ length: count }, (_, index) => index + 1),
    hasMore: count < total,
    loading,
    error,
    loadMore,
  }
}

function Demo({
  total = 7,
  auto = true,
  failOnce = false,
  scroll = false,
}: {
  total?: number
  auto?: boolean
  failOnce?: boolean
  scroll?: boolean
}) {
  const { items, hasMore, loading, error, loadMore } = usePages(total, failOnce)
  return (
    <div
      style={
        scroll
          ? {
              height: '14rem',
              overflow: 'auto',
              border: '1px solid var(--border)',
              padding: 'var(--space-md)',
            }
          : undefined
      }
    >
      <InfiniteList
        label="Notes"
        items={items}
        getKey={(item) => String(item)}
        renderItem={(item) => <Card title={`Note ${item}`}>Body of note {item}</Card>}
        hasMore={hasMore}
        loading={loading}
        error={error}
        auto={auto}
        onLoadMore={loadMore}
        loadMoreLabel="Load more notes"
        loadingLabel="Loading notes"
        endLabel="That is all of them"
        errorLabel="Could not load notes"
        retryLabel="Try again"
      />
    </div>
  )
}

const notes = (canvas: { getByRole: (r: 'list', o: { name: string }) => HTMLElement }) =>
  canvas.getByRole('list', { name: 'Notes' }).querySelectorAll('li')

export const KeyboardLoadMoreMovesFocusToTheEnd: Story = {
  render: () => <Demo auto={false} />,
  play: async ({ canvas, userEvent }) => {
    await expect(notes(canvas)).toHaveLength(3)
    // 마지막 항목 안에는 포커스할 것이 없으니 Tab 한 번에 버튼
    await userEvent.tab()
    const button = canvas.getByRole('button', { name: 'Load more notes' })
    await expect(button).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(notes(canvas)).toHaveLength(6))
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(notes(canvas)).toHaveLength(7))
    // 버튼이 사라지면 포커스는 끝 안내로
    await waitFor(() => expect(canvas.getByText('That is all of them')).toHaveFocus())
    await expect(canvas.queryByRole('button', { name: 'Load more notes' })).toBeNull()
  },
}

export const AutoLoadsWhenTheEndScrollsIntoView: Story = {
  render: () => <Demo scroll total={9} />,
  play: async ({ canvas }) => {
    const scroller = canvas.getByRole('list', { name: 'Notes' }).parentElement!.parentElement!
    await waitFor(() => expect(notes(canvas).length).toBeGreaterThanOrEqual(3))
    const before = notes(canvas).length
    scroller.scrollTo({ top: scroller.scrollHeight })
    await waitFor(() => expect(notes(canvas).length).toBeGreaterThan(before))
  },
}

export const FailureStopsAutoLoadingAndOffersRetry: Story = {
  render: () => <Demo auto={false} failOnce />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Load more notes' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Could not load notes')
    await expect(notes(canvas)).toHaveLength(3)
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(notes(canvas)).toHaveLength(6))
  },
}

export const LoadingShowsAStatus: Story = {
  render: () => <Demo auto={false} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Load more notes' }))
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading notes')
    await waitFor(() => expect(canvas.getByRole('status')).toBeEmptyDOMElement())
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  render: () => <Demo auto={false} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('list', { name: 'Notes' })).toBeVisible()
  },
}
