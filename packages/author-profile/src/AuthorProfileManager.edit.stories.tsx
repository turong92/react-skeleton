import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen, waitFor, within } from 'storybook/test'
import { ManagerDemo as Demo } from './stories/ManagerDemo'
import { profile } from './test/fixtures'

/**
 * 프로필 관리의 이름 바꾸기 · 삭제. 이름 바꾸기는 **한 번에 한 줄**만 열린다(오류 · 진행이 다른 줄로 새지 않는다). 저장 · 취소 뒤 포커스는 그 줄의 「Rename」으로 돌아오고,
 * 삭제는 확인 창(`ConfirmDialog`)이 「되돌릴 수 없고 글은 삭제된 사용자로 남는다」고 말한 뒤 — 지운 뒤 포커스는 그 자리의 다음 줄(없으면 새 이름 칸)로 간다.
 */
const ann = profile('prf_a', 'Ann', '0001')
const bea = profile('prf_b', 'Bea', '0002')

const meta = {
  title: 'Packages/author-profile/AuthorProfileManager edit',
  component: Demo,
  parameters: { layout: 'padded' },
  args: { profiles: [ann, bea] },
} satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof meta>

export const RenamingInPlaceReturnsFocusToTheRenameButton: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Rename Ann#0001' }))
    const input = canvas.getByLabelText('New name for Ann#0001')
    await expect(input).toHaveFocus()
    await expect(input).toHaveValue('Ann')
    await userEvent.clear(input)
    await userEvent.type(input, 'Zed')
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    const renamed = await canvas.findByRole('button', { name: /Rename Zed#/ })
    await waitFor(() => expect(renamed).toHaveFocus())
    await expect(canvas.queryByRole('button', { name: 'Rename Ann#0001' })).toBeNull()
  },
}

export const CancelChecksTheNameAndReturnsFocus: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Rename Ann#0001' }))
    const input = canvas.getByLabelText('New name for Ann#0001')
    await userEvent.clear(input)
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    await expect(await canvas.findByText('Enter a name.')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }))
    const rename = canvas.getByRole('button', { name: 'Rename Ann#0001' })
    await waitFor(() => expect(rename).toHaveFocus())
  },
}

/** 키보드만으로 — Tab 으로 「Rename」, Enter 로 열고, 쓰고, Enter 로 저장하면 포커스가 그 줄의 「Rename」 으로 */
export const RenameWorksFromTheKeyboardOnly: Story = {
  play: async ({ canvas, userEvent }) => {
    const rename = await canvas.findByRole('button', { name: 'Rename Ann#0001' })
    rename.focus()
    await userEvent.keyboard('{Enter}')
    const input = canvas.getByLabelText('New name for Ann#0001')
    await expect(input).toHaveFocus()
    await userEvent.keyboard('{Control>}a{/Control}Zed{Enter}')
    const renamed = await canvas.findByRole('button', { name: /Rename Zed#/ })
    await waitFor(() => expect(renamed).toHaveFocus())
  },
}

/** 한 번에 한 줄만 — 오류가 열린 줄에서 다른 줄을 열면(취소 없이) 앞의 줄은 닫히고 오류는 새 줄로 따라가지 않는다 */
export const OnlyOneRowEditsAtATimeAndTheErrorDoesNotLeak: Story = {
  args: { failNext: { rename: 'AUTHOR_PROFILE.RATE_LIMITED' } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Rename Ann#0001' }))
    await userEvent.type(canvas.getByLabelText('New name for Ann#0001'), 'x')
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Too many profile changes.')
    await expect(canvas.getByLabelText('New name for Ann#0001')).toBeVisible() // 오류가 열린 줄

    // 취소하지 않고 다른 줄을 연다
    await userEvent.click(canvas.getByRole('button', { name: 'Rename Bea#0002' }))
    await expect(canvas.queryByLabelText('New name for Ann#0001')).toBeNull()
    await expect(canvas.getByLabelText('New name for Bea#0002')).toHaveFocus()
    await expect(canvas.queryByRole('alert')).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Rename Ann#0001' })).toBeVisible()
    await expect(canvas.getAllByRole('form')).toHaveLength(2) // 추가 폼 + 열린 한 줄
  },
}

/** 서버가 아는 사실이 어긋났다 — 이미 지워진 프로필의 이름 바꾸기는 「더는 없다」 고 말한다 */
export const RenamingAGoneProfileSaysItIsGone: Story = {
  args: { failNext: { rename: 'AUTHOR_PROFILE.NOT_FOUND' } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Rename Ann#0001' }))
    await userEvent.type(canvas.getByLabelText('New name for Ann#0001'), 'x')
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    // 줄은 다시 가져온 목록에서 사라지고, 오류 문장은 목록 위에 남는다
    await expect(await canvas.findByText('That profile no longer exists.')).toBeVisible()
    await waitFor(() =>
      expect(canvas.queryByRole('button', { name: 'Rename Ann#0001' })).toBeNull(),
    )
    await expect(canvas.getByRole('button', { name: 'Rename Bea#0002' })).toBeVisible()
  },
}

export const DeleteAsksFirstAndSaysPostsStay: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Delete Ann#0001' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete Ann#0001?' })
    await expect(dialog).toHaveTextContent('This cannot be undone.')
    await expect(dialog).toHaveTextContent('Deleted user')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(canvas.getAllByRole('listitem')).toHaveLength(2)
    // 지우지 않고 닫으면 포커스는 창을 연 단추로
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Delete Ann#0001' })).toHaveFocus(),
    )
  },
}

/** 지운 뒤 포커스는 그 자리의 다음 줄(여기서는 Bea 의 「Rename」), 마지막 줄을 지우면 새 이름 칸 — 지운 단추와 함께 body 로 떨어지지 않는다 */
export const AfterDeletingFocusLandsOnTheNextRowOrTheNameField: Story = {
  play: async ({ canvas, userEvent }) => {
    const confirmDelete = async (name: string) => {
      await userEvent.click(await canvas.findByRole('button', { name: `Delete ${name}` }))
      await userEvent.click(
        within(await screen.findByRole('dialog', { name: `Delete ${name}?` })).getByRole('button', {
          name: 'Delete profile',
        }),
      )
    }
    await confirmDelete('Ann#0001')
    await waitFor(() => expect(canvas.getAllByRole('listitem')).toHaveLength(1))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Rename Bea#0002' })).toHaveFocus(),
    )
    await expect(canvas.getByText('1 of 5 profiles')).toBeVisible()

    await confirmDelete('Bea#0002') // 마지막 줄 — 다음 줄이 없다
    await waitFor(() => expect(canvas.queryByRole('list')).toBeNull())
    await waitFor(() => expect(canvas.getByLabelText('New profile name')).toHaveFocus())
  },
}

/** 지우기가 실패하면(이미 지워졌다 — NOT_FOUND) 창 안에서 말하고, 목록은 다시 가져와 그 줄이 사라진다. 창을 닫으면 포커스는 다음 자리로 */
export const DeleteFailureIsSaidInsideTheDialog: Story = {
  args: { failNext: { remove: 'AUTHOR_PROFILE.NOT_FOUND' } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Delete Ann#0001' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete Ann#0001?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete profile' }))
    await expect(await within(dialog).findByText('That profile no longer exists.')).toBeVisible()
    await waitFor(() =>
      expect(canvas.queryByRole('button', { name: 'Delete Ann#0001' })).toBeNull(),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Rename Bea#0002' })).toHaveFocus(),
    )
  },
}
