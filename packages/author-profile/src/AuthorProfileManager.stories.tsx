import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen, waitFor, within } from 'storybook/test'
import { AuthorProfileManager } from './AuthorProfileManager'
import {
  createFakeAuthorProfiles,
  type FakeAuthorProfilesOptions,
} from './stories/fakeAuthorProfiles'
import { WithQuery } from './stories/WithQuery'
import { profile } from './test/fixtures'

/**
 * 프로필 관리 — 목록 · 추가 · 이름 바꾸기 · 삭제. 삭제는 확인 창(`ConfirmDialog`)이 「되돌릴 수 없고 글은 삭제된 사용자로 남는다」고 말한다.
 * 서버의 답은 제자리에서 말한다: 이름 겹침(NAME_TAKEN) · 상한(LIMIT_REACHED) · 너무 잦음(RATE_LIMITED) · 이름 칸 오류(Required · Size · Pattern · Reserved).
 * 상한(`config.maxPerAccount`)에 닿으면 추가가 꺼지고 이유가 먼저 보인다. 계정 id · 프로필 id 는 화면에 없다.
 */
const ann = profile('prf_a', 'Ann', '0001')
const bea = profile('prf_b', 'Bea', '0002')

function Demo(options: FakeAuthorProfilesOptions) {
  return (
    <WithQuery>
      <AuthorProfileManager api={createFakeAuthorProfiles(options).api} />
    </WithQuery>
  )
}

const meta = {
  title: 'Packages/author-profile/AuthorProfileManager',
  component: Demo,
  parameters: { layout: 'padded' },
  args: { profiles: [ann, bea] },
  render: (args) => <Demo {...args} />,
} satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof meta>

export const ListsEveryProfileWithItsActions: Story = {
  play: async ({ canvas }) => {
    const list = await canvas.findByRole('list', { name: 'Your profiles' })
    await expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    await expect(canvas.getByText('2 of 5 profiles')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Rename Ann#0001' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Delete Bea#0002' })).toBeVisible()
    await expect(document.body.innerHTML).not.toContain('prf_')
  },
}

export const EmptyListSaysSo: Story = {
  args: { profiles: [] },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('You have no profiles yet.')).toBeVisible()
    await expect(canvas.queryByRole('list')).toBeNull()
  },
}

export const AddingAProfile: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText('New profile name'), '  Cy  ')
    await userEvent.click(canvas.getByRole('button', { name: 'Add profile' }))
    await expect(await canvas.findByRole('button', { name: /Rename Cy#/ })).toBeVisible()
    await expect(canvas.getByText('3 of 5 profiles')).toBeVisible()
    await expect(canvas.getByLabelText('New profile name')).toHaveValue('')
  },
}

export const ClientChecksTheNameFirst: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText('New profile name'), 'a#b')
    await userEvent.click(canvas.getByRole('button', { name: 'Add profile' }))
    await expect(await canvas.findByText('Names cannot contain # or @.')).toBeVisible()
    await expect(canvas.getByLabelText('New profile name')).toHaveAttribute('aria-invalid', 'true')
    await expect(canvas.getAllByRole('listitem')).toHaveLength(2)
  },
}

export const ServerFieldErrorLandsOnTheNameField: Story = {
  render: () => <Demo profiles={[ann]} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText('New profile name'), 'admin')
    await userEvent.click(canvas.getByRole('button', { name: 'Add profile' }))
    await expect(await canvas.findByText('That name is not available.')).toBeVisible()
  },
}

export const NameTakenIsSaidUnderTheField: Story = {
  args: { uniqueNames: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText('New profile name'), 'ann')
    await userEvent.click(canvas.getByRole('button', { name: 'Add profile' }))
    await expect(await canvas.findByText('You already use that name.')).toBeVisible()
    await expect(canvas.getAllByRole('listitem')).toHaveLength(2)
  },
}

export const LimitReachedTurnsAddingOffAndSaysWhy: Story = {
  args: { maxPerAccount: 2 },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText('You can have up to 2 profiles. Delete one to add another.'),
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Add profile' })).toBeDisabled()
    await expect(canvas.getByLabelText('New profile name')).toBeDisabled()
  },
}

export const RateLimitedShowsTheWait: Story = {
  args: { rateLimited: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText('New profile name'), 'Cy')
    await userEvent.click(canvas.getByRole('button', { name: 'Add profile' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Too many profile changes. Try again in 120 seconds.',
    )
  },
}

export const RenamingInPlace: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Rename Ann#0001' }))
    const input = canvas.getByLabelText('New name for Ann#0001')
    await expect(input).toHaveFocus()
    await expect(input).toHaveValue('Ann')
    await userEvent.clear(input)
    await userEvent.type(input, 'Zed')
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    await expect(await canvas.findByRole('button', { name: /Rename Zed#/ })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Rename Ann#0001' })).toBeNull()
  },
}

export const RenameCanBeCancelledAndChecksTheName: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Rename Ann#0001' }))
    const input = canvas.getByLabelText('New name for Ann#0001')
    await userEvent.clear(input)
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    await expect(await canvas.findByText('Enter a name.')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }))
    await expect(canvas.getByRole('button', { name: 'Rename Ann#0001' })).toBeVisible()
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

    await userEvent.click(canvas.getByRole('button', { name: 'Delete Ann#0001' }))
    await userEvent.click(
      within(await screen.findByRole('dialog', { name: 'Delete Ann#0001?' })).getByRole('button', {
        name: 'Delete profile',
      }),
    )
    await waitFor(() => expect(canvas.getAllByRole('listitem')).toHaveLength(1))
    await expect(canvas.queryByRole('button', { name: 'Rename Ann#0001' })).toBeNull()
    await expect(canvas.getByText('1 of 5 profiles')).toBeVisible()
  },
}
