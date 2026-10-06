import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { expect, fn, screen, waitFor } from 'storybook/test'
import { Button } from '../Button/Button'
import { ConfirmDialog } from './ConfirmDialog'

/**
 * 되돌릴 수 없는 동작 앞의 확인 창 — `Dialog` 위에. 처음 포커스는 「취소」(실수로 Enter 를 눌러도 안전), 문구를 치는 경우는 입력칸.
 * `typedConfirmation` 이면 문구를 정확히 쳐야 확인이 켜지고 입력칸에서 Enter 로도 확인한다(프로젝트 · 계정 삭제). 일하는 중에는 `busy`. 열 때마다 입력은 비워진다.
 */
const onConfirm = fn()
const meta = {
  title: 'UI/ConfirmDialog',
  component: ConfirmDialog,
  args: {
    open: false,
    onClose: fn(),
    onConfirm,
    title: 'Delete project',
    description: 'All notes in it will be deleted. This cannot be undone.',
    confirmLabel: 'Delete project',
    cancelLabel: 'Keep it',
  },
  beforeEach: () => onConfirm.mockClear(),
} satisfies Meta<typeof ConfirmDialog>
export default meta
type Story = StoryObj<typeof meta>

function Demo(props: Partial<ComponentProps<typeof ConfirmDialog>>) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete…
      </Button>
      <ConfirmDialog
        {...(meta.args as ComponentProps<typeof ConfirmDialog>)}
        {...props}
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          onConfirm()
          setOpen(false)
        }}
      />
    </>
  )
}

export const SimpleConfirmFocusesCancel: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Delete…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete project' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Keep it' })).toHaveFocus())
    await expect(dialog).toHaveTextContent('This cannot be undone.')
    await userEvent.click(screen.getByRole('button', { name: 'Delete project' }))
    await expect(onConfirm).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  },
}

export const CancelDoesNotConfirm: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Delete…' }))
    await screen.findByRole('dialog', { name: 'Delete project' })
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    await expect(onConfirm).not.toHaveBeenCalled()
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Delete…' })).toHaveFocus())
  },
}

export const TypedConfirmationGatesTheButton: Story = {
  render: () => (
    <Demo typedConfirmation={{ phrase: 'my-project', label: 'Type my-project to confirm' }} />
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Delete…' }))
    await screen.findByRole('dialog', { name: 'Delete project' })
    const input = screen.getByLabelText('Type my-project to confirm')
    await waitFor(() => expect(input).toHaveFocus())
    const confirm = screen.getByRole('button', { name: 'Delete project' })
    await expect(confirm).toBeDisabled()
    await userEvent.type(input, 'my-proj')
    await expect(confirm).toBeDisabled()
    await userEvent.type(input, 'ect')
    await expect(confirm).toBeEnabled()
    // 입력칸에서 Enter 로도 확인
    await userEvent.keyboard('{Enter}')
    await expect(onConfirm).toHaveBeenCalledTimes(1)
  },
}

export const TypedConfirmationIsClearedWhenReopened: Story = {
  render: () => (
    <Demo typedConfirmation={{ phrase: 'my-project', label: 'Type my-project to confirm' }} />
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Delete…' }))
    await screen.findByRole('dialog', { name: 'Delete project' })
    await userEvent.type(screen.getByLabelText('Type my-project to confirm'), 'my-project')
    // 합성 키 입력은 `<dialog>` 의 Esc 를 못 하니 같은 경로(`cancel` → `close`)를 `requestClose()` 로 탄다
    ;(screen.getByRole('dialog') as HTMLDialogElement).requestClose()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // `requestClose()` 는 `<dialog>` 를 바로 닫지만 부모의 `open` 상태는 `close` 이벤트(다음 작업)로 내려간다 — 그 전에 다시 누르면 「열기」가 아직 true 인 상태에 묻혀 사라진다.
    // 부모가 닫힘을 반영하면 `Dialog` 가 포커스를 여는 버튼으로 돌려주므로 그것을 기다린다(느린 러너에서 이 경주가 졌다)
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Delete…' })).toHaveFocus())
    await userEvent.click(canvas.getByRole('button', { name: 'Delete…' }))
    await screen.findByRole('dialog', { name: 'Delete project' })
    await expect(screen.getByLabelText('Type my-project to confirm')).toHaveValue('')
    await expect(screen.getByRole('button', { name: 'Delete project' })).toBeDisabled()
    await expect(onConfirm).not.toHaveBeenCalled()
  },
}

export const BusyLocksBothButtons: Story = {
  args: { open: true, busy: true },
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: 'Delete project' })
    await expect(dialog.querySelector('[data-cancel]')).toBeDisabled()
    await expect(screen.getByRole('button', { name: /Delete project/ })).toBeDisabled()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  args: { open: true },
  play: async () => {
    await expect(await screen.findByRole('dialog', { name: 'Delete project' })).toBeVisible()
  },
}
