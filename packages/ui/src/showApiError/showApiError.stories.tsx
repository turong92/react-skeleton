import { ApiRequestError } from '@skeleton/api-client'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Toaster } from 'sonner'
import { expect, screen } from 'storybook/test'
import { Button } from '../Button/Button'
import { showApiError } from './showApiError'

/**
 * API 에러를 토스트로 — `ApiRequestError` 는 제목 + 상세 + traceId(클릭하면 복사) · spanId 를, 그 외 Error 는 메시지만.
 * 앱 전역은 QueryClient 의 `onError` 에 한 번 걸어 두면 된다(스타터 참고). 토스트는 `<Toaster />`(보통 `ThemedToaster`)가 그린다.
 */
const meta = {
  title: 'UI/showApiError',
  parameters: { a11y: { test: 'error' } },
  decorators: [
    (Story) => (
      <>
        <Story />
        <Toaster />
      </>
    ),
  ],
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const apiError = () =>
  new ApiRequestError(
    {
      code: 'COMMON.VALIDATION_FAILED',
      title: 'Validation failed',
      status: 400,
      detail: 'email format invalid',
      traceId: 'trace-abc123',
      spanId: 'span-def456',
      timestamp: '2026-01-01T00:00:00Z',
    },
    'trace-abc123',
    'span-def456',
    '00-trace-abc123-span-def456-01',
  )

export const ApiProblem: Story = {
  render: () => <Button onClick={() => showApiError(apiError())}>Fail the request</Button>,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Fail the request' }))
    await expect(await screen.findByText('Validation failed')).toBeInTheDocument()
    await expect(screen.getByText('email format invalid')).toBeInTheDocument()
    await expect(screen.getByText('traceId: trace-abc123')).toBeInTheDocument()
    await expect(screen.getByText('spanId: span-def456')).toBeInTheDocument()
  },
}

export const PlainError: Story = {
  render: () => (
    <Button onClick={() => showApiError(new Error('Network down'))}>Fail offline</Button>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Fail offline' }))
    await expect(await screen.findByText('Network down')).toBeInTheDocument()
  },
}

export const TranslatedMessages: Story = {
  render: () => (
    <Button
      onClick={() =>
        showApiError(apiError(), {
          messages: { clickToCopy: '눌러서 복사', traceIdCopied: '복사했습니다' },
        })
      }
    >
      실패시키기
    </Button>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '실패시키기' }))
    await expect(await screen.findByTitle('눌러서 복사')).toBeInTheDocument()
  },
}
