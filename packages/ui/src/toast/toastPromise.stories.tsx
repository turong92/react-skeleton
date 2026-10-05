import type { Meta, StoryObj } from '@storybook/react-vite'
import { Toaster } from 'sonner'
import { expect, screen } from 'storybook/test'
import { Button } from '../Button/Button'
import { toastPromise } from './toastPromise'

/**
 * 약속 하나를 토스트 하나로 — 「로딩 → 성공/실패」가 같은 토스트 자리에서 바뀐다. 값은 그대로 돌려주고 실패는 다시 던진다(호출자가 이어서 처리).
 * 전역 에러 토스트(`showApiError`)와 같은 에러를 두 번 띄우지 않도록, 전역 핸들러를 거치지 않는 호출에 쓴다.
 */
const meta = {
  title: 'UI/toastPromise',
  parameters: { a11y: { test: 'error' } },
  decorators: [
    (Story) => (
      <>
        <Story />
        <Toaster />
      </>
    ),
  ],
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const later = <T,>(run: () => T, ms = 400) =>
  new Promise<T>((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(run())
      } catch (error) {
        reject(error)
      }
    }, ms),
  )

export const Success: Story = {
  render: () => (
    <Button
      onClick={() =>
        void toastPromise(
          later(() => 'Acme'),
          {
            loading: 'Creating project…',
            success: (name) => `Created ${name}`,
          },
        )
      }
    >
      Create
    </Button>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }))
    await expect(await screen.findByText('Creating project…')).toBeInTheDocument()
    await expect(await screen.findByText('Created Acme', {}, { timeout: 3000 })).toBeInTheDocument()
  },
}

export const Failure: Story = {
  render: () => (
    <Button
      onClick={() =>
        toastPromise(
          later(() => {
            throw new Error('Quota exceeded')
          }),
          { loading: 'Creating project…', success: 'Created' },
        ).catch(() => undefined)
      }
    >
      Create anyway
    </Button>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Create anyway' }))
    await expect(
      await screen.findByText('Quota exceeded', {}, { timeout: 3000 }),
    ).toBeInTheDocument()
  },
}
