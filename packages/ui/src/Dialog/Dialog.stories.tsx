import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, screen, waitFor } from 'storybook/test'
import { Button } from '../Button/Button'
import { Dialog } from './Dialog'

/**
 * 네이티브 `<dialog>` 모달 — 포커스 가두기 · Esc · 배경 막기를 브라우저가 한다. 열림 상태는 부모가 쥔다(`open` + `onClose`).
 * 닫으면 포커스가 연 버튼으로 돌아온다. 확인 · 취소 버튼은 `footer` 로.
 */
const meta = {
  title: 'UI/Dialog',
  component: Dialog,
  args: { open: false, onClose: fn(), title: 'Delete project', children: null },
} satisfies Meta<typeof Dialog>
export default meta
type Story = StoryObj<typeof meta>

function Demo({ onConfirm, text }: { onConfirm?: () => void; text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete project"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                onConfirm?.()
                setOpen(false)
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p>{text}</p>
      </Dialog>
    </>
  )
}

export const Default: Story = {
  render: () => <Demo text="This cannot be undone." />,
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Open dialog' })
    await userEvent.click(trigger)
    // 모달이 열리면 배경은 비활성이 되어 역할 조회에서 빠진다 — 다이얼로그는 screen 에서 찾는다
    const dialog = await screen.findByRole('dialog', { name: 'Delete project' })
    await expect(dialog).toBeVisible()
    await expect(screen.getByText('This cannot be undone.')).toBeVisible()
  },
}

/**
 * Esc 는 브라우저가 `<dialog>` 에 하는 일(cancel → close)이라 합성 키 입력으로는 닫히지 않는다.
 * 같은 경로(cancel → close → `onClose`)를 타는 `requestClose()` 로 Esc 를 대신한다 — 열림 상태가 부모로 돌아가고 포커스가 연 버튼으로 돌아오는지를 본다.
 */
export const EscapeClosesAndFocusReturns: Story = {
  render: () => <Demo text="Press Escape to close." />,
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Open dialog' })
    await userEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'Delete project' })
    // `close` 이벤트는 비동기로 온다 — 도착(= 부모의 `onClose` 가 열림 상태를 닫음)을 기다린 뒤에 다음 동작을 한다
    const closed = new Promise((resolve) =>
      dialog.addEventListener('close', resolve, { once: true }),
    )
    ;(dialog as HTMLDialogElement).requestClose()
    await closed
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(trigger).toHaveFocus()
    // 부모의 열림 상태도 닫혔다 — 그래서 다시 눌러 열 수 있다(`onClose` 가 안 이어지면 상태가 `open` 에 남아 다시 안 열린다)
    await userEvent.click(trigger)
    await expect(await screen.findByRole('dialog', { name: 'Delete project' })).toBeVisible()
  },
}

export const CloseButtonAndCancel: Story = {
  render: () => <Demo text="Use the × button." />,
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Open dialog' })
    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(trigger).toHaveFocus()
  },
}

export const FooterAction: Story = {
  render: (_, { args }) => <Demo text="Confirm to delete." onConfirm={args.onClose} />,
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    await expect(args.onClose).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  },
}

/** 열리면 브라우저가 모달로 만든다(배경 비활성 · 포커스 가두기) — 포커스가 다이얼로그 안으로 들어온다 */
export const FocusMovesInside: Story = {
  render: () => <Demo text="Focus moves into the dialog." />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete project' })
    await expect(dialog.matches(':modal')).toBe(true)
    await expect(dialog.contains(document.activeElement)).toBe(true)
  },
}

export const LongContent: Story = {
  render: () => <Demo text={'A long explanation that keeps going. '.repeat(60)} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete project' })
    await expect(dialog.getBoundingClientRect().height).toBeLessThanOrEqual(window.innerHeight)
  },
}
