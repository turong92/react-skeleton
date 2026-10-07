import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'
import { createFakeAuthorProfiles } from './stories/fakeAuthorProfiles'
import { CreateFlowDemo } from './stories/CreateFlowDemo'

/**
 * 닉네임이 없을 때 선택기의 「닉네임 만들기」가 대화상자(프로필 관리)를 연다 — `useProfileDialog`.
 * 쓰던 글은 폼에 그대로 남고, 만든 뒤 닫으면 포커스가 사라진 단추 대신 선택기 자리로 간다(body 로 떨어지지 않는다).
 */
const meta = {
  title: 'Packages/author-profile/ProfileDialog',
  component: CreateFlowDemo,
  parameters: { layout: 'padded' },
  render: (args) => <CreateFlowDemo {...args} />,
} satisfies Meta<typeof CreateFlowDemo>
export default meta
type Story = StoryObj<typeof meta>

export const CreatingAProfileKeepsTheDraftAndTheFocus: Story = {
  args: { api: createFakeAuthorProfiles().api },
  play: async ({ canvas, userEvent }) => {
    const draft = await canvas.findByRole('textbox', { name: 'Draft' })
    await userEvent.type(draft, 'half-written post')
    const create = await canvas.findByRole('button', { name: 'Create a nickname' })
    await expect(create).toHaveAttribute('aria-haspopup', 'dialog')
    await userEvent.click(create)

    const dialog = await within(document.body).findByRole('dialog')
    // 안내 문장과 관리 화면(「0 of 5 nicknames」) 사이에 숨 쉴 간격이 있다 — 붙어 있으면 한 덩어리 글로 읽힌다
    const intro = within(dialog).getByText('Without a nickname you show up as Unnamed.')
    const count = await within(dialog).findByText(/of \d+ nicknames/)
    await expect(
      count.getBoundingClientRect().top - intro.getBoundingClientRect().bottom,
    ).toBeGreaterThanOrEqual(8)
    await userEvent.type(within(dialog).getByLabelText('New nickname'), 'Ann')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add nickname' }))
    await within(dialog).findByText(/Ann/)
    await userEvent.click(within(dialog).getAllByRole('button', { name: 'Close' })[0])

    await waitFor(() => expect(within(document.body).queryByRole('dialog')).toBeNull())
    await expect(draft).toHaveValue('half-written post') // 쓰던 글이 남는다
    // 「닉네임 만들기」 단추는 사라졌고, 선택기 자리의 새 단추(이름 고르기)가 포커스를 받는다
    await expect(canvas.queryByRole('button', { name: 'Create a nickname' })).toBeNull()
    const picker = await canvas.findByRole('button', { name: /Choose a nickname/ })
    await waitFor(() => expect(picker).toHaveFocus())
  },
}
