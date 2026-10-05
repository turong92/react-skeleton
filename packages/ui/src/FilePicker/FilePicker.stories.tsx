import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
import { FilePicker } from './FilePicker'

/**
 * 파일 고르기 — 끌어다 놓기 + 버튼. 앱에서는 날 `<input type="file">` 을 쓸 수 없으니 이것을 쓴다.
 * 고른(놓은) 파일은 `onFiles` 로 나온다 — 검증 · 업로드는 호출하는 쪽(보통 `useUpload`)이 한다. 오류는 `error` 로 되돌려 준다.
 */
const meta = {
  title: 'UI/FilePicker',
  component: FilePicker,
  args: {
    title: 'Attach a file',
    hint: 'Images, PDF or text — up to 5 MB',
    buttonLabel: 'Choose file',
    onFiles: fn(),
  },
} satisfies Meta<typeof FilePicker>
export default meta
type Story = StoryObj<typeof meta>

const file = (name: string) => new File(['hello'], name, { type: 'text/plain' })

/** 진짜 `DragEvent` 를 보낸다(브라우저의 `DataTransfer` 에 파일을 담는다) */
function dragEvent(type: 'dragover' | 'drop', target: HTMLElement, names: string[] = []) {
  const dataTransfer = new DataTransfer()
  for (const name of names) dataTransfer.items.add(file(name))
  target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }))
}

export const ChoosesWithTheInput: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('group', { name: 'Attach a file' })).toBeVisible()
    const input = canvas.getByLabelText('Choose file', { selector: 'input' })
    await userEvent.upload(input, file('a.txt'))
    await expect(args.onFiles).toHaveBeenCalledTimes(1)
    await expect((args.onFiles as ReturnType<typeof fn>).mock.calls[0][0][0].name).toBe('a.txt')
  },
}

export const KeyboardOpensTheChooser: Story = {
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByLabelText('Choose file', { selector: 'input' }) as HTMLInputElement
    let opened = 0
    input.addEventListener('click', (event) => {
      opened += 1
      event.preventDefault() // 진짜 파일 창은 열지 않는다
    })
    await userEvent.tab()
    await expect(canvas.getByRole('button', { name: 'Choose file' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    await expect(opened).toBe(2)
  },
}

export const Drop: Story = {
  play: async ({ canvas, args }) => {
    const zone = canvas.getByRole('group', { name: 'Attach a file' })
    dragEvent('dragover', zone)
    await waitFor(() => expect(zone).toHaveAttribute('data-dragging', 'true'))
    dragEvent('drop', zone, ['dropped.txt'])
    await waitFor(() => expect(zone).not.toHaveAttribute('data-dragging'))
    await expect((args.onFiles as ReturnType<typeof fn>).mock.calls[0][0][0].name).toBe(
      'dropped.txt',
    )
  },
}

export const SingleFileKeepsTheFirst: Story = {
  play: async ({ canvas, args }) => {
    const zone = canvas.getByRole('group', { name: 'Attach a file' })
    dragEvent('drop', zone, ['one.txt', 'two.txt'])
    await expect((args.onFiles as ReturnType<typeof fn>).mock.calls[0][0]).toHaveLength(1)
  },
}

export const WithError: Story = {
  args: { invalid: true, error: 'That file is larger than 5 MB.' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('That file is larger than 5 MB.')
    await expect(canvas.getByRole('group', { name: 'Attach a file' })).toHaveAccessibleDescription(
      /That file is larger than 5 MB\./,
    )
  },
}

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole('button', { name: 'Choose file' })).toBeDisabled()
    dragEvent('drop', canvas.getByRole('group', { name: 'Attach a file' }), ['x.txt'])
    await expect(args.onFiles).not.toHaveBeenCalled()
  },
}

export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /Choose file/ })).toBeDisabled()
    await expect(canvas.getByRole('status')).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  args: { invalid: true, error: 'Not allowed.' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toBeVisible()
  },
}
