import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
import { CopyButton } from './CopyButton'

/**
 * 글자를 클립보드로 복사하는 버튼 — 결과(「복사됨」 · 실패)는 같은 자리의 `role="status"` 로 낭독되고 잠시 뒤 되돌아온다.
 * 복사할 값은 화면에 그리지 않는다. 초대 링크 · 토큰 · 참조 번호에. 글자는 모두 prop.
 */
const onCopy = fn()
const meta = {
  title: 'UI/CopyButton',
  component: CopyButton,
  args: {
    value: 'https://example.com/invite/abc',
    label: 'Copy link',
    copiedLabel: 'Link copied',
    onCopy,
    resetMs: 300,
  },
  beforeEach: () => onCopy.mockClear(),
} satisfies Meta<typeof CopyButton>
export default meta
type Story = StoryObj<typeof meta>

export const CopiesAndConfirms: Story = {
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Copy link' })
    await userEvent.click(button)
    // 헤드리스 브라우저의 클립보드 권한은 환경마다 달라 성공 · 실패 어느 쪽이든 결과가 낭독되는지를 본다
    await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1))
    await expect(canvas.getByRole('status')).not.toBeEmptyDOMElement()
    // 잠시 뒤 처음으로
    await waitFor(() => expect(canvas.getByRole('status')).toBeEmptyDOMElement())
    await expect(canvas.getByRole('button', { name: 'Copy link' })).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Copy link' })).toBeVisible()
  },
}
