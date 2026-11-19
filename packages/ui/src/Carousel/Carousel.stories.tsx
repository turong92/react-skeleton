import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'
import { Card } from '../Card/Card'
import { Carousel } from './Carousel'

/**
 * 옆으로 넘기는 줄(WAI-ARIA APG carousel). CSS scroll-snap 이라 손가락 스와이프 · 트랙패드는 네이티브 스크롤 그대로고,
 * 이전 · 다음 단추(테두리 상자)와 ←/→ 키(줄 · 단추에 포커스가 있을 때)로도 넘긴다. 처음 · 끝에서는 단추가 `aria-disabled`(눌러도 아무 일 없음).
 * 슬라이드는 `aria-label="n / 전체"` 로 낭독되고 같은 글자가 현재 위치 표시다. 자동 재생은 없다 — 슬라이드는 한 번에 하나씩 보이는 폭.
 */
const meta = {
  title: 'UI/Carousel',
  component: Carousel,
  args: {
    label: 'Featured plans',
    children: null,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <Carousel {...args}>
      <Card title="Starter">
        <p>For trying things out.</p>
      </Card>
      <Card title="Team">
        <p>For a small group.</p>
      </Card>
      <Card title="Scale">
        <p>For everyone else.</p>
      </Card>
    </Carousel>
  ),
} satisfies Meta<typeof Carousel>
export default meta
type Story = StoryObj<typeof meta>

const position = (canvas: { getByText: (text: string) => HTMLElement }, text: string) =>
  waitFor(() => expect(canvas.getByText(text)).toBeVisible())

export const Default: Story = {
  play: async ({ canvas }) => {
    const region = canvas.getByRole('region', { name: 'Featured plans' })
    await expect(region).toHaveAttribute('aria-roledescription', 'carousel')
    for (const n of [1, 2, 3])
      await expect(canvas.getByRole('group', { name: `${n} / 3` })).toHaveAttribute(
        'aria-roledescription',
        'slide',
      )
    await position(canvas, '1 / 3') // 위치 표시(슬라이드의 이름은 aria-label 이라 글자와 겹치지 않는다)
    await expect(canvas.getByRole('button', { name: 'Previous slide' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  },
}

export const NextAndPreviousButtons: Story = {
  play: async ({ canvas, userEvent }) => {
    const next = canvas.getByRole('button', { name: 'Next slide' })
    const previous = canvas.getByRole('button', { name: 'Previous slide' })
    await userEvent.click(previous) // 처음에서는 아무 일 없다
    await position(canvas, '1 / 3')

    await userEvent.click(next)
    await position(canvas, '2 / 3')
    await expect(previous).not.toHaveAttribute('aria-disabled')
    await userEvent.click(next)
    await position(canvas, '3 / 3')
    await expect(next).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(next) // 끝에서도 아무 일 없다
    await position(canvas, '3 / 3')

    await userEvent.click(previous)
    await position(canvas, '2 / 3')
  },
}

export const ArrowKeys: Story = {
  play: async ({ canvas, userEvent }) => {
    const track = canvas.getByRole('region', { name: 'Featured plans' }).querySelector('[tabindex]')
    await userEvent.click(canvas.getByRole('region', { name: 'Featured plans' }))
    ;(track as HTMLElement).focus()
    await userEvent.keyboard('{ArrowRight}')
    await position(canvas, '2 / 3')
    await userEvent.keyboard('{ArrowRight}')
    await position(canvas, '3 / 3')
    await userEvent.keyboard('{ArrowLeft}')
    await position(canvas, '2 / 3')
  },
}

/** 손가락 스와이프는 네이티브 스크롤이다 — 스크롤하면 위치 표시가 따라온다 */
export const NativeScrollUpdatesPosition: Story = {
  play: async ({ canvas }) => {
    const track = canvas
      .getByRole('region', { name: 'Featured plans' })
      .querySelector<HTMLElement>('[tabindex]')!
    track.scrollTo({ left: track.clientWidth * 2, behavior: 'instant' })
    await position(canvas, '3 / 3')
  },
}

export const SlideLabelsAreProps: Story = {
  args: {
    previousLabel: '이전',
    nextLabel: '다음',
    slideLabel: (n, total) => `${total}장 중 ${n}`,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('group', { name: '3장 중 2' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: '다음' })).toBeInTheDocument()
  },
}
