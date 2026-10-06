import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, waitFor } from 'storybook/test'
import { CodeEntry } from './CodeEntry'

/**
 * 인증번호 입력 — 숫자 칸 6개. 붙여넣으면 채워지고, Backspace 는 앞 칸으로 넘어가고, 다 채우면 버튼 없이 제출된다(`onComplete`).
 * 오류 문구가 오면 칸을 비우고 처음으로 돌아온다. 「다시 보내기」는 대기 시간 동안 눌리지 않는다. 라벨 · 문구는 모두 prop.
 */
const meta = {
  title: 'UI/CodeEntry',
  component: CodeEntry,
  args: {
    label: 'Verification code',
    digitLabel: (position: number, total: number) => `Digit ${position} of ${total}`,
    onComplete: fn(),
  },
} satisfies Meta<typeof CodeEntry>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    const group = canvas.getByRole('group', { name: 'Verification code' })
    await expect(group).toBeVisible()
    const first = canvas.getByLabelText('Digit 1 of 6')
    await expect(first).toHaveAttribute('autocomplete', 'one-time-code')
    for (let i = 1; i <= 6; i++)
      await expect(canvas.getByLabelText(`Digit ${i} of 6`)).toHaveAttribute('inputmode', 'numeric')
  },
}

export const TypingFillsAndSubmitsOnTheSixthDigit: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByLabelText('Digit 1 of 6'))
    await userEvent.keyboard('12345')
    await expect(args.onComplete).not.toHaveBeenCalled()
    await userEvent.keyboard('6')
    await waitFor(() => {
      expect(args.onComplete).toHaveBeenCalledTimes(1)
      expect(args.onComplete).toHaveBeenCalledWith('123456')
    })
  },
}

export const PasteFillsEverythingFromAnyCell: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByLabelText('Digit 3 of 6'))
    await userEvent.paste('482 915')
    await waitFor(() => {
      expect(args.onComplete).toHaveBeenCalledTimes(1)
      expect(args.onComplete).toHaveBeenCalledWith('482915')
    })
    await expect(canvas.getByLabelText('Digit 1 of 6')).toHaveValue('4')
    await expect(canvas.getByLabelText('Digit 6 of 6')).toHaveValue('5'.replace('5', '5'))
  },
}

export const BackspaceStepsBackAcrossCells: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByLabelText('Digit 1 of 6'))
    await userEvent.keyboard('123')
    await expect(canvas.getByLabelText('Digit 4 of 6')).toHaveFocus()
    await userEvent.keyboard('{Backspace}') // 빈 칸 → 앞 칸(3)을 비우고 그리로
    await expect(canvas.getByLabelText('Digit 3 of 6')).toHaveFocus()
    await expect(canvas.getByLabelText('Digit 3 of 6')).toHaveValue('')
    await userEvent.keyboard('{Backspace}{Backspace}')
    await expect(canvas.getByLabelText('Digit 1 of 6')).toHaveValue('')
    await expect(args.onComplete).not.toHaveBeenCalled()
  },
}

export const ArrowKeysMoveBetweenCells: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByLabelText('Digit 3 of 6'))
    await userEvent.keyboard('{ArrowRight}')
    await expect(canvas.getByLabelText('Digit 4 of 6')).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    await expect(canvas.getByLabelText('Digit 2 of 6')).toHaveFocus()
  },
}

export const LettersAreIgnored: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByLabelText('Digit 1 of 6'))
    await userEvent.keyboard('abc')
    await expect(canvas.getByLabelText('Digit 1 of 6')).toHaveValue('')
    await expect(args.onComplete).not.toHaveBeenCalled()
  },
}

function WrongCodeDemo({ onComplete }: { onComplete: (code: string) => void }) {
  const [error, setError] = useState<string | undefined>(undefined)
  return (
    <CodeEntry
      label="Verification code"
      digitLabel={(i, n) => `Digit ${i} of ${n}`}
      error={error}
      onComplete={(code) => {
        onComplete(code)
        setError('That code is not right. 4 attempts left.')
      }}
    />
  )
}

export const WrongCodeShowsTheErrorAndStartsOver: Story = {
  render: (args) => <WrongCodeDemo onComplete={args.onComplete} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByLabelText('Digit 1 of 6'))
    await userEvent.keyboard('000000')
    await expect(await canvas.findByRole('alert')).toHaveTextContent('4 attempts left')
    // 칸은 비워지고 첫 칸으로 돌아온다 — 바로 다시 칠 수 있다
    await waitFor(() => expect(canvas.getByLabelText('Digit 1 of 6')).toHaveValue(''))
    await expect(canvas.getByLabelText('Digit 1 of 6')).toHaveFocus()
    await expect(canvas.getByLabelText('Digit 1 of 6')).toHaveAttribute('aria-invalid', 'true')
  },
}

export const ResendCooldown: Story = {
  args: {
    resend: {
      label: 'Send a new code',
      onResend: fn(),
      secondsLeft: 24,
      waitLabel: (seconds: number) => `You can ask again in ${seconds} s`,
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Send a new code' })).toBeDisabled()
    await expect(canvas.getByText('You can ask again in 24 s')).toBeVisible()
  },
}

export const ResendReady: Story = {
  args: { resend: { label: 'Send a new code', onResend: fn(), secondsLeft: 0 } },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Send a new code' }))
    await expect(args.resend?.onResend).toHaveBeenCalledTimes(1)
  },
}

export const BusyLocksTheCells: Story = {
  args: { busy: true },
  play: async ({ canvas }) => {
    for (let i = 1; i <= 6; i++)
      await expect(canvas.getByLabelText(`Digit ${i} of 6`)).toBeDisabled()
  },
}
