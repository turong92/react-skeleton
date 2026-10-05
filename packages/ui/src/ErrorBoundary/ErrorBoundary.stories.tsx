import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect } from 'storybook/test'
import { ErrorBoundary } from './ErrorBoundary'

/**
 * 렌더링 중 던져진 에러를 잡아 대체 화면을 보인다(앱 루트 한 곳 + 위험한 구역마다). 기본 대체 화면은 `role="alert"` + 다시 시도 버튼 —
 * 글자는 `title` · `retryLabel`, 모양을 바꾸려면 `fallback(error, reset)`. TanStack Query 의 비동기 에러는 여기서 안 잡힌다(쿼리의 `isError`).
 */
const meta = {
  title: 'UI/ErrorBoundary',
  component: ErrorBoundary,
  args: { children: null },
} satisfies Meta<typeof ErrorBoundary>
export default meta
type Story = StoryObj<typeof meta>

function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new Error('The report could not be rendered')
  return <p>Report is fine</p>
}

function Recovering() {
  // 첫 렌더는 던지고, 다시 시도를 누르면 고쳐진 상태로 그린다
  const [fixed, setFixed] = useState(false)
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div role="alert">
          <p>{error.message}</p>
          <button
            type="button"
            onClick={() => {
              setFixed(true)
              reset()
            }}
          >
            Fix and retry
          </button>
        </div>
      )}
    >
      <Bomb explode={!fixed} />
    </ErrorBoundary>
  )
}

export const Healthy: Story = {
  render: () => (
    <ErrorBoundary>
      <Bomb explode={false} />
    </ErrorBoundary>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Report is fine')).toBeVisible()
    await expect(canvas.queryByRole('alert')).toBeNull()
  },
}

export const DefaultFallback: Story = {
  parameters: { a11y: { test: 'error' } },
  render: () => (
    <ErrorBoundary>
      <Bomb explode />
    </ErrorBoundary>
  ),
  play: async ({ canvas }) => {
    const alert = canvas.getByRole('alert')
    await expect(alert).toHaveTextContent('Something went wrong')
    await expect(alert).toHaveTextContent('The report could not be rendered')
    await expect(canvas.getByRole('button', { name: 'Try again' })).toBeVisible()
  },
}

export const CustomText: Story = {
  render: () => (
    <ErrorBoundary title="문제가 생겼습니다" retryLabel="다시 시도">
      <Bomb explode />
    </ErrorBoundary>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('문제가 생겼습니다')
    await expect(canvas.getByRole('button', { name: '다시 시도' })).toBeVisible()
  },
}

export const RecoversAfterRetry: Story = {
  render: () => <Recovering />,
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('The report could not be rendered')
    await userEvent.click(canvas.getByRole('button', { name: 'Fix and retry' }))
    await expect(canvas.getByText('Report is fine')).toBeVisible()
  },
}
