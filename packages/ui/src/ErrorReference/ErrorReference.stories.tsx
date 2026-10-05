import { ApiRequestError } from '@skeleton/api-client'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { ErrorReference } from './ErrorReference'

/**
 * 오류 화면 · 배너 아래의 「참조 번호 + 복사」 — 문의할 때 서버 로그의 그 요청을 바로 찾게 한다.
 * 토스트는 사라지므로 `showApiError(error)` 가 돌려준 번호를 상태에 담아 `reference` 로 넘기거나, 오류를 `error` 로 그대로 넘긴다.
 * 글자(라벨 · 복사 · 복사함)는 모두 prop 이다 — 번역된 문구를 앱이 넘긴다.
 */
const meta = {
  title: 'UI/ErrorReference',
  component: ErrorReference,
  args: { reference: '4bf92f3577b34da6a3ce929d0e0e4736' },
} satisfies Meta<typeof ErrorReference>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Reference')).toBeVisible()
    await expect(canvas.getByText('4bf92f3577b34da6a3ce929d0e0e4736')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Copy' })).toHaveAccessibleDescription(
      '4bf92f3577b34da6a3ce929d0e0e4736',
    )
  },
}

/** 헤드리스 브라우저의 클립보드 권한과 무관하게 계약(복사된 글자)을 잰다 */
function fakeClipboard(fail = false) {
  const written: string[] = []
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        if (fail) throw new DOMException('denied', 'NotAllowedError')
        written.push(text)
      },
    },
  })
  return written
}

export const CopyAnnouncesTheResult: Story = {
  play: async ({ canvas, userEvent }) => {
    const written = fakeClipboard()
    const status = canvas.getByRole('status')
    await expect(status).toHaveTextContent('')
    await userEvent.tab()
    await expect(canvas.getByRole('button', { name: 'Copy' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(await canvas.findByText('Copied')).toBeVisible()
    await expect(written).toEqual(['4bf92f3577b34da6a3ce929d0e0e4736'])
  },
}

export const CopyDeniedSelectsTheNumberInstead: Story = {
  play: async ({ canvas, userEvent }) => {
    fakeClipboard(true)
    await userEvent.click(canvas.getByRole('button', { name: 'Copy' }))
    await expect(window.getSelection()?.toString()).toBe('4bf92f3577b34da6a3ce929d0e0e4736')
    await expect(canvas.getByRole('status')).toHaveTextContent('')
  },
}

export const FromAnApiError: Story = {
  args: {
    reference: undefined,
    error: new ApiRequestError(
      {
        code: 'COMMON.INTERNAL_ERROR',
        title: 'Something went wrong',
        status: 500,
        timestamp: '2026-01-01T00:00:00Z',
        traceId: 'trace-from-error-01',
      },
      'trace-from-error-01',
      'aaaaaaaaaaaaaaaa',
      'tp',
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('trace-from-error-01')).toBeVisible()
  },
}

export const PlainErrorShowsNothing: Story = {
  args: { reference: undefined, error: new Error('Network down') },
  render: (args) => (
    <div data-testid="host">
      <ErrorReference {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId('host')).toBeEmptyDOMElement()
  },
}

export const Translated: Story = {
  args: { label: '문의 번호', copyLabel: '복사', copiedLabel: '복사했어요' },
  play: async ({ canvas, userEvent }) => {
    fakeClipboard()
    await userEvent.click(canvas.getByRole('button', { name: '복사' }))
    await expect(await canvas.findByText('복사했어요')).toBeVisible()
  },
}

export const LongReferenceWrapsInANarrowColumn: Story = {
  args: { reference: 'x'.repeat(96) },
  render: (args) => (
    <div style={{ maxWidth: '14rem' }}>
      <ErrorReference {...args} />
    </div>
  ),
  play: async () => {
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Copy' })).toBeVisible()
  },
}
