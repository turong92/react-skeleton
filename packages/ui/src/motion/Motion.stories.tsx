import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { flushSync } from 'react-dom'
import { expect, waitFor } from 'storybook/test'
import { Button } from '../Button/Button'
import { Card } from '../Card/Card'
import { Stat } from '../Stat/Stat'
import { startViewTransition } from './startViewTransition'
import { useCountUp } from './useCountUp'
import { usePrefersReducedMotion } from './prefersReducedMotion'
import { useReveal } from './useReveal'

/**
 * 움직임 기본 훅 넷 — 취향 효과(색종이 · 3D 기울이기)는 없다. 모두 **움직임 줄이기 설정이면 바로 끝 모양**이고, 서버 · 자바스크립트 전에는 처음부터 보인다.
 *  - `useReveal({ index, staggerMs })` — 화면에 들어올 때 한 번 나타난다(0.3초 ease-out, 차례 지연은 `index × staggerMs`). 요소에 펼친다: `<li {...reveal}>`
 *  - `useCountUp(target, { durationMs, startOnView, decimals })` — 숫자가 올라간다(ease-out). `{ value, ref }` 를 돌려주고 `startOnView` 면 `ref` 요소가 들어올 때 시작
 *  - `startViewTransition(update)` — View Transitions API 를 얇게 감싼다. 없거나 움직임 줄이기면 `update` 만 실행. React 에서는 `update` 안에서 `flushSync` 로 상태를 바로 반영한다
 *  - `usePrefersReducedMotion()` — 설정을 따라가는 값(직접 움직임을 만드는 화면이 쓴다)
 */
const meta = {
  title: 'UI/Motion',
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

function RevealItem({ index, children }: { index: number; children: string }) {
  const reveal = useReveal<HTMLLIElement>({ index })
  return (
    <li {...reveal}>
      <Card title={children}>
        <p>Appears in turn.</p>
      </Card>
    </li>
  )
}

export const RevealStagger: Story = {
  render: () => (
    <ul style={{ display: 'grid', gap: 'var(--space-md)', padding: 0, listStyle: 'none' }}>
      {['First', 'Second', 'Third'].map((name, index) => (
        <RevealItem key={name} index={index}>
          {name}
        </RevealItem>
      ))}
    </ul>
  ),
  play: async ({ canvasElement }) => {
    const items = [...canvasElement.querySelectorAll<HTMLElement>('li')]
    await expect(items.map((li) => li.style.transitionDelay)).toEqual(['0ms', '60ms', '120ms'])
    // 화면 안에 있으니 한 번 보이고 끝난다(움직임 줄이기 설정이면 숨겨지지도 않는다)
    await waitFor(() =>
      items.forEach((li) => expect(li.dataset.reveal === 'shown' || !li.dataset.reveal).toBe(true)),
    )
    await expect(canvasElement.querySelector('[data-reveal="hidden"]')).toBeNull()
  },
}

function Counter() {
  const { value, ref } = useCountUp<HTMLDivElement>(1284, { startOnView: true })
  return (
    <div ref={ref}>
      <Stat label="Members" value={value.toLocaleString('en-US')} />
    </div>
  )
}

export const CountUp: Story = {
  render: () => <Counter />,
  play: async ({ canvas }) => {
    // 올라가는 동안에는 끝 값이 아니다가(움직임 줄이기면 바로) 끝에서 정확히 목표 값이 된다
    await waitFor(() => expect(canvas.getByText('1,284')).toBeVisible(), { timeout: 3000 })
  },
}

function Transition() {
  const [view, setView] = useState<'list' | 'detail'>('list')
  return (
    <>
      <Button
        onClick={() =>
          void startViewTransition(() =>
            flushSync(() => setView((current) => (current === 'list' ? 'detail' : 'list'))),
          )
        }
      >
        Switch view
      </Button>
      <p>{view === 'list' ? 'List view' : 'Detail view'}</p>
    </>
  )
}

export const ViewTransition: Story = {
  render: () => <Transition />,
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText('List view')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Switch view' }))
    // 미지원 브라우저 · 움직임 줄이기에서도 화면은 바뀐다
    await waitFor(() => expect(canvas.getByText('Detail view')).toBeVisible())
  },
}

function ReducedMotionState() {
  const reduced = usePrefersReducedMotion()
  return <p>{reduced ? 'Motion reduced' : 'Motion on'}</p>
}

export const PrefersReducedMotion: Story = {
  render: () => <ReducedMotionState />,
  play: async ({ canvas }) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    await expect(canvas.getByText(reduced ? 'Motion reduced' : 'Motion on')).toBeVisible()
  },
}
