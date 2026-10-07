import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
import { createFakeAuthorProfiles } from './stories/fakeAuthorProfiles'
import { createMemoryStorage } from './stories/memoryStorage'
import { PickerDemo } from './stories/PickerDemo'
import { profile } from './test/fixtures'

/**
 * 작성자 선택기 — 게시판 글 · 댓글 폼의 `authorPicker` 에 꽂는다. 접힌 상태는 **지금 고른 `이름#꼬리표` 하나**만 제출 단추 옆에 늘 보이고(없으면 「프로필 고르기」 단추),
 * 목록은 눌러야 열린다(메뉴 단추 — ↑↓ Home End Esc). 처음 값은 ① 이 스레드에서 쓴 프로필 ② 이 기기가 이 게시판에서 기억하는 프로필 ③ 비어 있음.
 * **이 스레드에서 쓴 프로필과 다른 것으로 바꿀 때만** 한 줄 확인이 나온다 — 늘 떠 있는 경고는 없다. 프로필이 없으면 「프로필 만들기」 진입. 계정 id 는 화면 어디에도 없다.
 */
const ann = profile('prf_a', 'Ann', '0001')
const bea = profile('prf_b', 'Bea', '0002')
const storage = createMemoryStorage()
const onChange = fn()

const meta = {
  title: 'Packages/author-profile/AuthorPicker',
  component: PickerDemo,
  parameters: { layout: 'centered' },
  args: {
    api: createFakeAuthorProfiles({ profiles: [ann, bea] }).api,
    storage,
    onChange,
  },
  render: (args) => (
    <PickerDemo {...args} api={createFakeAuthorProfiles({ profiles: [ann, bea] }).api} />
  ),
  beforeEach: () => {
    storage.reset()
    onChange.mockClear()
  },
} satisfies Meta<typeof PickerDemo>
export default meta
type Story = StoryObj<typeof meta>

export const FoldedShowsOnlyTheRememberedProfile: Story = {
  args: { remembered: 'prf_b' },
  play: async ({ canvas, userEvent }) => {
    const trigger = await canvas.findByRole('button', { name: /Writing as Bea#0002/ })
    await expect(trigger).toHaveTextContent('Bea#0002')
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByText(/Ann/)).toBeNull()
    await expect(canvas.queryByRole('menu')).toBeNull()
    // 계정 id 는 저장소 키 안에만 있고 화면 어디에도 없다
    await expect(document.body).not.toHaveTextContent('acc_')
    await expect(document.body.innerHTML).not.toContain('acc_story')

    await userEvent.click(trigger)
    const menu = await canvas.findByRole('menu')
    await expect(menu).toBeVisible()
    await expect(canvas.getByRole('menuitemradio', { name: 'Bea#0002' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expect(canvas.getByRole('menuitemradio', { name: 'Ann#0001' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(canvas.queryByRole('menu')).toBeNull())
    await expect(trigger).toHaveFocus()
  },
}

export const ThisThreadBeatsTheDeviceMemory: Story = {
  args: { remembered: 'prf_b', threadAuthorId: 'prf_a' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: /Writing as Ann#0001/ })).toBeVisible()
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('prf_a'))
  },
}

export const NothingToStartFromLeavesItEmpty: Story = {
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button', { name: 'Choose a profile' })
    await expect(button).toBeVisible()
    await expect(button).toHaveTextContent('Choose a profile')
    await expect(onChange).not.toHaveBeenCalled()
  },
}

export const InvalidWhenTheFormAskedForAChoice: Story = {
  args: { invalid: true },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: 'Choose a profile' })).toBeVisible()
    await expect(document.querySelector('[data-invalid="true"]')).not.toBeNull()
  },
}

export const ChoosingWithNoThreadProfileAsksNothingAndIsRemembered: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Choose a profile' }))
    await userEvent.click(await canvas.findByRole('menuitemradio', { name: 'Bea#0002' }))
    await expect(await canvas.findByRole('button', { name: /Writing as Bea#0002/ })).toBeVisible()
    await expect(canvas.queryByRole('status')).toBeNull()
    await expect(onChange).toHaveBeenLastCalledWith('prf_b')
    await expect(Object.values(storage.dump())).toEqual(['prf_b'])
  },
}

export const SwitchingAwayFromTheThreadProfileAsksOnce: Story = {
  args: { threadAuthorId: 'prf_a' },
  play: async ({ canvas, userEvent }) => {
    const trigger = await canvas.findByRole('button', { name: /Writing as Ann#0001/ })
    await expect(canvas.queryByRole('status')).toBeNull() // 평소에는 경고가 없다

    // 같은 프로필을 다시 고르면 묻지 않는다
    await userEvent.click(trigger)
    await userEvent.click(await canvas.findByRole('menuitemradio', { name: 'Ann#0001' }))
    await expect(canvas.queryByRole('status')).toBeNull()

    // 다른 프로필 → 한 줄 확인, 값은 아직 그대로
    await userEvent.click(trigger)
    await userEvent.click(await canvas.findByRole('menuitemradio', { name: 'Bea#0002' }))
    await expect(await canvas.findByRole('status')).toHaveTextContent(
      'You wrote in this thread as Ann#0001.',
    )
    await expect(canvas.getByRole('button', { name: /Writing as Ann#0001/ })).toBeVisible()
    await expect(storage.dump()).toEqual({})

    // 유지
    await userEvent.click(canvas.getByRole('button', { name: 'Keep Ann#0001' }))
    await expect(canvas.queryByRole('status')).toBeNull()
    await expect(canvas.getByRole('button', { name: /Writing as Ann#0001/ })).toBeVisible()

    // 다시 골라 확인
    await userEvent.click(canvas.getByRole('button', { name: /Writing as Ann#0001/ }))
    await userEvent.click(await canvas.findByRole('menuitemradio', { name: 'Bea#0002' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Use Bea#0002' }))
    await expect(await canvas.findByRole('button', { name: /Writing as Bea#0002/ })).toBeVisible()
    await expect(canvas.queryByRole('status')).toBeNull()
    await expect(Object.values(storage.dump())).toEqual(['prf_b'])
  },
}

export const KeyboardOnly: Story = {
  args: { remembered: 'prf_a' },
  play: async ({ canvas, userEvent }) => {
    const trigger = await canvas.findByRole('button', { name: /Writing as Ann#0001/ })
    trigger.focus()
    await userEvent.keyboard('{ArrowDown}')
    await expect(await canvas.findByRole('menu')).toBeVisible()
    await expect(canvas.getByRole('menuitemradio', { name: 'Ann#0001' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await expect(await canvas.findByRole('button', { name: /Writing as Bea#0002/ })).toHaveFocus()
  },
}

export const NoProfilesOffersToCreateOne: Story = {
  args: { onCreateProfile: fn() },
  render: (args) => <PickerDemo {...args} api={createFakeAuthorProfiles().api} />,
  play: async ({ canvas, args, userEvent }) => {
    const create = await canvas.findByRole('button', { name: 'Create a profile' })
    await expect(canvas.queryByRole('button', { name: /Writing as/ })).toBeNull()
    await userEvent.click(create)
    await expect(args.onCreateProfile).toHaveBeenCalledTimes(1)
  },
}

export const ADeletedRememberedProfileIsIgnored: Story = {
  args: { remembered: 'prf_gone' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: 'Choose a profile' })).toBeVisible()
    await expect(onChange).not.toHaveBeenCalled()
  },
}

export const LoadFailureCanBeRetried: Story = {
  render: (args) => {
    const fake = createFakeAuthorProfiles({ profiles: [ann] }).api
    let calls = 0
    return (
      <PickerDemo
        {...args}
        api={{
          ...fake,
          list: () => (calls++ === 0 ? Promise.reject(new Error('offline')) : fake.list()),
        }}
      />
    )
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Could not load profiles/ }))
    await expect(await canvas.findByRole('button', { name: 'Choose a profile' })).toBeVisible()
  },
}

export const DisabledWhileSending: Story = {
  args: { remembered: 'prf_a', disabled: true },
  play: async ({ canvas, userEvent }) => {
    const trigger = await canvas.findByRole('button', { name: /Writing as Ann#0001/ })
    await expect(trigger).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(trigger)
    await expect(canvas.queryByRole('menu')).toBeNull()
  },
}
