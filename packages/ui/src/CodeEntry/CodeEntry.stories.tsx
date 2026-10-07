import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, waitFor } from 'storybook/test'
import { CodeEntry, type CodeTimeLabels } from './CodeEntry'

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

/* ---------------------------------------------------------------------------------------------------------------------------
 * 남은 시간(`expiresAt`) — 시계는 스토리가 쥔 가짜 시계(`now`)다. 컴포넌트는 매 틱마다 `now()` 를 다시 읽으므로(감산이 아니다)
 * 시계를 앞으로 돌리면 다음 초 경계(최대 1초)에 화면이 따라온다. 실제 10분을 기다리지 않는다.
 * ------------------------------------------------------------------------------------------------------------------------- */

const timeLabels: CodeTimeLabels = {
  remaining: (clock) => `Time left ${clock}`,
  minuteLeft: 'One minute left',
  secondsLeft: (seconds) => `${seconds} seconds left`,
  expired: 'Time is up. Get a new code.',
}

function fakeClock(start = 1_700_000_000_000) {
  let t = start
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms
    },
  }
}

const slow = { timeout: 4000 }

export const CountdownNormal: Story = {
  render: (args) => {
    const clock = fakeClock()
    return (
      <CodeEntry
        {...args}
        now={clock.now}
        expiresAt={clock.now() + 582_000}
        timeLabels={timeLabels}
        expirySource="server"
      />
    )
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Time left 09:42')).toBeVisible()
    await expect(canvas.queryByRole('alert')).toBeNull()
    // 읽어 주는 영역은 문턱 전까지 비어 있다
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement()
  },
}

function UnderMinuteDemo() {
  const [clock] = useState(() => fakeClock())
  return (
    <div>
      <CodeEntry
        label="Verification code"
        digitLabel={(i, n) => `Digit ${i} of ${n}`}
        onComplete={() => undefined}
        now={clock.now}
        expiresAt={clock.now() + 75_000}
        timeLabels={timeLabels}
      />
      <button type="button" onClick={() => clock.advance(20_000)}>
        +20s
      </button>
      <button type="button" onClick={() => clock.advance(7_000)}>
        +7s
      </button>
    </div>
  )
}

export const UnderOneMinuteIsEmphasisedAndAnnouncedOnce: Story = {
  render: () => <UnderMinuteDemo />,
  play: async ({ canvas, userEvent }) => {
    const time = await canvas.findByText('Time left 01:15')
    await expect(time).toHaveAttribute('data-stage', 'normal')
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement()
    await userEvent.click(canvas.getByRole('button', { name: '+20s' }))
    // 60초 아래: 굵게 · 밑줄(색만이 아니다) + 한 번 읽는다
    await waitFor(
      () => expect(canvas.getByText('Time left 00:55')).toHaveAttribute('data-stage', 'minute'),
      slow,
    )
    await expect(canvas.getByRole('status')).toHaveTextContent('One minute left')
    await expect(getComputedStyle(canvas.getByText('Time left 00:55')).textDecorationLine).toBe(
      'underline',
    )
    // 같은 단계 안에서 초가 흘러도 읽어 주는 글은 그대로다(초마다 낭독하지 않는다)
    await userEvent.click(canvas.getByRole('button', { name: '+20s' }))
    await waitFor(() => expect(canvas.getByText('Time left 00:35')).toBeVisible(), slow)
    await expect(canvas.getByRole('status')).toHaveTextContent('One minute left')
    await userEvent.click(canvas.getByRole('button', { name: '+20s' }))
    await waitFor(() => expect(canvas.getByText('Time left 00:15')).toBeVisible(), slow)
    await userEvent.click(canvas.getByRole('button', { name: '+7s' }))
    await waitFor(
      () => expect(canvas.getByRole('status')).toHaveTextContent('10 seconds left'),
      slow,
    )
  },
}

function ExpiryDemo({ onResend, noResend }: { onResend: () => void; noResend?: boolean }) {
  const [clock] = useState(() => fakeClock())
  const [expiresAt, setExpiresAt] = useState(() => clock.now() + 3_000)
  return (
    <div>
      <CodeEntry
        label="Verification code"
        digitLabel={(i, n) => `Digit ${i} of ${n}`}
        onComplete={() => undefined}
        now={clock.now}
        expiresAt={expiresAt}
        timeLabels={timeLabels}
        resend={
          noResend
            ? undefined
            : {
                label: 'Send again',
                onResend: () => {
                  onResend()
                  setExpiresAt(clock.now() + 600_000)
                },
                secondsLeft: 0,
              }
        }
        restart={noResend ? { label: 'Start over', onRestart: onResend } : undefined}
      />
      <button type="button" onClick={() => clock.advance(4_000)}>
        +4s
      </button>
    </div>
  )
}

export const ExpiredLocksTheCellsAndFocusesResend: Story = {
  render: (args) => <ExpiryDemo onResend={() => args.onComplete('resent')} />,
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Time left 00:03')
    await userEvent.click(canvas.getByRole('button', { name: '+4s' }))
    await expect(await canvas.findByRole('alert', {}, slow)).toHaveTextContent(
      'Time is up. Get a new code.',
    )
    for (let i = 1; i <= 6; i++)
      await expect(canvas.getByLabelText(`Digit ${i} of 6`)).toBeDisabled()
    await waitFor(
      () => expect(canvas.getByRole('button', { name: 'Send again' })).toHaveFocus(),
      slow,
    )
  },
}

/** 더 다시 보낼 수 없는 번호가 만료되면 — 막다른 길이 아니라 「처음부터 다시」 버튼으로 포커스가 간다 */
export const ExpiredWithNoResendFocusesTheRestart: Story = {
  render: (args) => <ExpiryDemo noResend onResend={() => args.onComplete('restarted')} />,
  play: async ({ canvas, userEvent, args }) => {
    await canvas.findByText('Time left 00:03')
    await expect(canvas.queryByRole('button', { name: 'Start over' })).toBeNull() // 만료 전에는 없다
    await userEvent.click(canvas.getByRole('button', { name: '+4s' }))
    await waitFor(
      () => expect(canvas.getByRole('button', { name: 'Start over' })).toHaveFocus(),
      slow,
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Start over' }))
    await expect(args.onComplete).toHaveBeenCalledWith('restarted')
  },
}

export const ResendResetsTheCountdown: Story = {
  render: (args) => <ExpiryDemo onResend={() => args.onComplete('resent')} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: '+4s' }))
    await canvas.findByRole('alert', {}, slow)
    await userEvent.click(canvas.getByRole('button', { name: 'Send again' }))
    await expect(args.onComplete).toHaveBeenCalledWith('resent')
    // 새 10분 — 칸이 풀리고 첫 칸에 포커스
    await waitFor(() => expect(canvas.getByText('Time left 10:00')).toBeVisible(), slow)
    await expect(canvas.queryByRole('alert')).toBeNull()
    await expect(canvas.getByLabelText('Digit 1 of 6')).toBeEnabled()
    await waitFor(() => expect(canvas.getByLabelText('Digit 1 of 6')).toHaveFocus(), slow)
  },
}

export const ResendCooldownInSecondsOnTheButton: Story = {
  args: {
    resend: {
      label: 'Send again',
      onResend: fn(),
      secondsLeft: 27,
      labelWhileWaiting: (seconds: number) => `Send again (${seconds} s)`,
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Send again (27 s)' })).toBeDisabled()
  },
}

function ReloadDemo() {
  const [clock] = useState(() => fakeClock())
  const [expiresAt] = useState(() => clock.now() + 600_000) // 서버가 준 절대 시각 — 새로고침해도 같다
  const [mounted, setMounted] = useState(1)
  return (
    <div>
      <CodeEntry
        key={mounted}
        label="Verification code"
        digitLabel={(i, n) => `Digit ${i} of ${n}`}
        onComplete={() => undefined}
        now={clock.now}
        expiresAt={expiresAt}
        timeLabels={timeLabels}
      />
      <button
        type="button"
        onClick={() => {
          clock.advance(100_000) // 100초 지난 뒤 새로고침
          setMounted((n) => n + 1)
        }}
      >
        Reload after 100s
      </button>
    </div>
  )
}

export const ReloadRestoresTheRemainingTime: Story = {
  render: () => <ReloadDemo />,
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Time left 10:00')
    await userEvent.click(canvas.getByRole('button', { name: 'Reload after 100s' }))
    // 처음부터 10분이 아니라, 남은 8분 20초
    await expect(await canvas.findByText('Time left 08:20')).toBeVisible()
  },
}
