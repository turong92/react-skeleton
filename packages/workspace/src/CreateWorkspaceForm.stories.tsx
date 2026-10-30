import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { CreateDemo } from './stories/Demos'

/**
 * 워크스페이스 만들기 — 이름을 치면 주소 이름을 제안하고(직접 고치면 그 값), 비워 두면 서버가 정한다.
 * 겹치는 주소 이름은 그 칸에서 말한다. 만들어지면 `onCreated(workspace)` — 새 팀의 주소로 가는 것은 앱이 한다
 */
const meta = {
  title: 'Packages/workspace/CreateWorkspaceForm',
  component: CreateDemo,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CreateDemo>
export default meta
type Story = StoryObj<typeof meta>

export const SuggestsTheAddressFromTheName: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText(/워크스페이스 이름/), 'Moon Light')
    await expect(canvas.getByLabelText('주소 이름')).toHaveValue('moon-light')
    await userEvent.click(canvas.getByRole('button', { name: '워크스페이스 만들기' }))
    await expect(await canvas.findByRole('status', { name: 'log' })).toHaveTextContent(
      'created:moon-light',
    )
  },
}

export const AnEditedAddressIsKept: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText(/워크스페이스 이름/), 'Moon Light')
    const address = canvas.getByLabelText('주소 이름')
    await userEvent.clear(address)
    await userEvent.type(address, 'night')
    await userEvent.type(canvas.getByLabelText(/워크스페이스 이름/), ' Two')
    await expect(address).toHaveValue('night')
  },
}

export const ANameWithoutLatinLettersLeavesTheAddressToTheServer: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText(/워크스페이스 이름/), '우리 팀')
    await expect(canvas.getByLabelText('주소 이름')).toHaveValue('')
    await userEvent.click(canvas.getByRole('button', { name: '워크스페이스 만들기' }))
    await expect(await canvas.findByRole('status', { name: 'log' })).toHaveTextContent(
      'created:team',
    )
  },
}

export const ChecksTheFieldsBeforeSending: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '워크스페이스 만들기' }))
    await expect(await canvas.findByText('이름을 입력해 주세요.')).toBeVisible()
    await userEvent.type(canvas.getByLabelText(/워크스페이스 이름/), 'Acme')
    await userEvent.clear(canvas.getByLabelText('주소 이름'))
    await userEvent.type(canvas.getByLabelText('주소 이름'), 'Bad_Name')
    await userEvent.click(canvas.getByRole('button', { name: '워크스페이스 만들기' }))
    await expect(await canvas.findByText(/영문 소문자 · 숫자 · 하이픈만 쓰고/)).toBeVisible()
  },
}

export const TakenAddressIsExplainedOnTheField: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText(/워크스페이스 이름/), 'Anything')
    const address = canvas.getByLabelText('주소 이름')
    await userEvent.clear(address)
    await userEvent.type(address, 'globex')
    await userEvent.click(canvas.getByRole('button', { name: '워크스페이스 만들기' }))
    await expect(
      await canvas.findByText('이미 쓰고 있는 주소 이름이에요. 다른 이름을 써 주세요.'),
    ).toBeVisible()
    await expect(address).toHaveAttribute('aria-invalid', 'true')
  },
}

export const CancelLeavesTheFormToTheApp: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '취소' }))
    await expect(await canvas.findByRole('status', { name: 'log' })).toHaveTextContent('cancel')
  },
}
