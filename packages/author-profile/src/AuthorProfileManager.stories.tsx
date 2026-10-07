import type { Meta, StoryObj } from '@storybook/react-vite'
import { ApiRequestError } from '@skeleton/api-client'
import { expect, within } from 'storybook/test'
import type { AuthorProfileApi } from './authorProfileApi'
import { createFakeAuthorProfiles } from './stories/fakeAuthorProfiles'
import { ManagerDemo as Demo } from './stories/ManagerDemo'
import { profile } from './test/fixtures'

/**
 * 프로필 관리 — 목록 · 추가(이 파일) · 이름 바꾸기 · 삭제(`AuthorProfileManager.edit.stories.tsx`).
 * 서버의 답은 제자리에서 말한다: 이름 겹침(NAME_TAKEN) · 상한(LIMIT_REACHED) · 너무 잦음(RATE_LIMITED) · 이름 칸 오류(Required · Size · Pattern · Reserved).
 * 상한(`config.maxPerAccount`)에 닿으면 추가가 꺼지고 이유가 먼저 보인다. 계정 id · 프로필 id 는 화면에 없다.
 */
const ann = profile('prf_a', 'Ann', '0001')
const bea = profile('prf_b', 'Bea', '0002')

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
    await expect(
      await canvas.findByText('That name has characters that are not allowed.'),
    ).toBeVisible()
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
  args: { takenNames: ['Taken'] },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText('New profile name'), 'taken')
    await userEvent.click(canvas.getByRole('button', { name: 'Add profile' }))
    await expect(await canvas.findByText('That name is taken.')).toBeVisible()
    await expect(canvas.getAllByRole('listitem')).toHaveLength(2)
  },
}

export const LimitReachedTurnsAddingOffAndSaysWhy: Story = {
  args: { maxPerAccount: 2 },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('You can have up to 2 profiles.')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Add profile' })).toBeDisabled()
    await expect(canvas.getByLabelText('New profile name')).toBeDisabled()
    // 이유 문장이 추가 칸 · 단추의 설명으로 이어져 있다(낭독기가 꺼진 이유를 읽는다)
    await expect(canvas.getByLabelText('New profile name')).toHaveAccessibleDescription(
      /You can have up to 2 profiles\./,
    )
    await expect(canvas.getByRole('button', { name: 'Add profile' })).toHaveAccessibleDescription(
      'You can have up to 2 profiles.',
    )
  },
}

export const RateLimitedWhenAddingDoesNotPromiseATime: Story = {
  args: { rateLimited: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText('New profile name'), 'Cy')
    await userEvent.click(canvas.getByRole('button', { name: 'Add profile' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Too many profile changes. Try again later.',
    )
  },
}

/** 서버가 아는 사실이 화면과 어긋났다 — 목록은 상한 아래로 보였는데 서버는 LIMIT_REACHED. 그 자리에서 말하고 목록을 다시 가져온다 */
export const ServerSaysLimitReachedWhileTheListLookedFree: Story = {
  args: { failNext: { create: 'AUTHOR_PROFILE.LIMIT_REACHED' } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText('New profile name'), 'Cy')
    await userEvent.click(canvas.getByRole('button', { name: 'Add profile' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'You can have up to 5 profiles.',
    )
    await expect(canvas.getByLabelText('New profile name')).toHaveValue('Cy') // 쓴 이름은 남는다
  },
}

/** 이름이 없는 프로필 · 꼬리표가 없는 프로필 — 글자 「null」 도 빈 `#` 도 없고, 단추 이름도 자연스럽다 */
export const UnnamedAndTaglessProfilesReadNaturally: Story = {
  args: {
    profiles: [
      { id: 'prf_n', name: null, tag: null, createdAt: '2026-01-01T00:00:00Z' },
      { id: 'prf_t', name: 'Ann', tag: null, createdAt: '2026-01-02T00:00:00Z' },
    ],
  },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByRole('button', { name: 'Rename Unnamed' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Delete Ann' })).toBeVisible()
    await expect(document.body).not.toHaveTextContent('null')
    await expect(document.body).not.toHaveTextContent('#')
    // 이름 없는 줄의 이름 바꾸기는 빈 칸으로 열린다(「null」 이 칸에 들어가지 않는다)
    await userEvent.click(canvas.getByRole('button', { name: 'Rename Unnamed' }))
    await expect(canvas.getByLabelText('New name for Unnamed')).toHaveValue('')
  },
}

/**
 * 추가가 실패한 같은 이름을 다시 보내면 **같은 `Idempotency-Key`** — 첫 시도가 서버에 닿았는지 모를 때(네트워크 오류) 프로필이 둘 생기지 않게.
 * 이름을 바꾸면 새 키다. 서버가 확정해 답한 4xx 뒤의 다시 보내기도 새 키(상한 · 이름 겹침이 풀린 뒤의 새 제출).
 */
const keys: (string | undefined)[] = []
export const ResendingTheSameNameReusesTheKey: Story = {
  beforeEach: () => {
    keys.length = 0
  },
  render: () => {
    const fake = createFakeAuthorProfiles({ profiles: [ann] }).api
    let calls = 0
    const api: AuthorProfileApi = {
      ...fake,
      create: (input, options) => {
        keys.push(options?.idempotencyKey)
        if (calls++ === 0)
          return Promise.reject(
            new ApiRequestError(
              { code: 'CLIENT.NETWORK_ERROR', title: 'offline', status: 0, timestamp: 'now' },
              't',
              's',
              'tp',
            ),
          )
        return fake.create(input, options)
      },
    }
    return <Demo api={api} />
  },
  play: async ({ canvas, userEvent }) => {
    const field = await canvas.findByLabelText('New profile name')
    await userEvent.type(field, 'Cy')
    await userEvent.click(canvas.getByRole('button', { name: 'Add profile' }))
    await expect(await canvas.findByRole('alert')).toBeVisible() // 닿았는지 모르는 실패
    await userEvent.click(canvas.getByRole('button', { name: 'Add profile' })) // 같은 이름 다시
    await expect(await canvas.findByRole('button', { name: /Rename Cy#/ })).toBeVisible()
    await expect(keys).toHaveLength(2)
    await expect(keys[0]).toBeTruthy()
    await expect(keys[1]).toBe(keys[0])
    // 성공했으니 다음 제출은 새 키
    await userEvent.type(field, 'Di')
    await userEvent.click(canvas.getByRole('button', { name: 'Add profile' }))
    await expect(await canvas.findByRole('button', { name: /Rename Di#/ })).toBeVisible()
    await expect(keys[2]).not.toBe(keys[0])
  },
}
