import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, screen, waitFor } from 'storybook/test'
import { Button } from '../Button/Button'
import { Drawer } from './Drawer'

/**
 * 가장자리에서 밀려 나오는 판 — 필터 · 상세 · 모바일 메뉴. `Dialog` 와 같은 구현(`placement`)이라 포커스 가두기 · Esc · 닫기 버튼 · 스크롤 잠금이 같다.
 * 열림 상태는 부모가 쥔다(`open` + `onClose`). `side` 는 `right`(기본) · `left` · `bottom`. 덮개(바깥)를 눌러도 닫힌다.
 * 모양은 `--overlay-*` 부품 토큰, 열고 닫을 때 transform 으로 밀려 들어오고 나가며 모션 감소 설정이면 바로 바뀐다.
 */
const meta = {
  title: 'UI/Drawer',
  component: Drawer,
  args: { open: false, onClose: fn(), title: 'Filters', children: null },
} satisfies Meta<typeof Drawer>
export default meta
type Story = StoryObj<typeof meta>

function Demo({ side, onClosed }: { side?: 'left' | 'right' | 'bottom'; onClosed?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open drawer</Button>
      <Drawer
        open={open}
        side={side}
        title="Filters"
        onClose={() => {
          onClosed?.()
          setOpen(false)
        }}
        footer={<Button onClick={() => setOpen(false)}>Apply</Button>}
      >
        <p>Narrow the list down.</p>
      </Drawer>
    </>
  )
}

export const Default: Story = {
  render: (args) => <Demo onClosed={args.onClose} />,
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Open drawer' })
    await userEvent.click(trigger)
    const drawer = await screen.findByRole('dialog', { name: 'Filters' })
    await expect(drawer).toBeVisible()
    // Dialog 와 같은 모달 — 배경은 비활성, 포커스는 판 안으로
    await expect(drawer.matches(':modal')).toBe(true)
    await expect(drawer.contains(document.activeElement)).toBe(true)
    // 오른쪽 가장자리에 붙는다
    await waitFor(() =>
      expect(Math.round(drawer.getBoundingClientRect().right)).toBe(window.innerWidth),
    )
  },
}

export const Left: Story = {
  render: () => <Demo side="left" />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open drawer' }))
    const drawer = await screen.findByRole('dialog', { name: 'Filters' })
    await waitFor(() => expect(Math.round(drawer.getBoundingClientRect().left)).toBe(0))
  },
}

export const Bottom: Story = {
  render: () => <Demo side="bottom" />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open drawer' }))
    const drawer = await screen.findByRole('dialog', { name: 'Filters' })
    await waitFor(() =>
      expect(Math.round(drawer.getBoundingClientRect().bottom)).toBe(window.innerHeight),
    )
    await expect(drawer.getBoundingClientRect().width).toBe(window.innerWidth)
  },
}

/** 닫기 버튼 · 덮개 누름 · Esc(`requestClose` — 합성 키는 `<dialog>` 의 cancel 을 못 낸다) 모두 `onClose` 로 돌아오고 포커스가 연 버튼에 돌아온다 */
export const ClosesByButtonBackdropAndEscape: Story = {
  render: (args) => <Demo onClosed={args.onClose} />,
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: 'Open drawer' })
    const gone = () => waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole('button', { name: 'Close' }))
    await gone()
    await expect(args.onClose).toHaveBeenCalledTimes(1)
    await expect(trigger).toHaveFocus()

    await userEvent.click(trigger)
    const drawer = await screen.findByRole('dialog', { name: 'Filters' })
    // 덮개를 누르면 클릭 대상이 `<dialog>` 자신이다 — 대상이 자신인 클릭을 보낸다
    drawer.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await gone()
    await expect(args.onClose).toHaveBeenCalledTimes(2)

    await userEvent.click(trigger)
    const again = await screen.findByRole('dialog', { name: 'Filters' })
    const closed = new Promise((resolve) =>
      again.addEventListener('close', resolve, { once: true }),
    )
    ;(again as HTMLDialogElement).requestClose()
    await closed
    await gone()
    await expect(args.onClose).toHaveBeenCalledTimes(3)
    await expect(trigger).toHaveFocus()
  },
}

/** 판 안의 내용을 눌러도 닫히지 않는다 — 덮개만 닫는다 */
export const ClickingInsideStaysOpen: Story = {
  render: (args) => <Demo onClosed={args.onClose} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open drawer' }))
    await userEvent.click(await screen.findByText('Narrow the list down.'))
    await expect(screen.getByRole('dialog', { name: 'Filters' })).toBeVisible()
    await expect(args.onClose).not.toHaveBeenCalled()
  },
}
