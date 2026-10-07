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
/** 이름이 없는 프로필(이름 없는 옛 글을 넘겨받은 첫 프로필) · 꼬리표가 없는 서버 — 글자 「null」 도 빈 `#` 도 없다 */
export const UnnamedAndTaglessProfilesReadNaturally: Story = {
  args: { remembered: 'prf_n' },
  render: (args) => (
    <PickerDemo
      {...args}
      api={
        createFakeAuthorProfiles({
          profiles: [
            { id: 'prf_n', name: null, tag: null, createdAt: '2026-01-01T00:00:00Z' },
            { id: 'prf_t', name: 'Ann', tag: null, createdAt: '2026-01-02T00:00:00Z' },
          ],
        }).api
      }
    />
  ),
  play: async ({ canvas, userEvent }) => {
    const trigger = await canvas.findByRole('button', {
      name: 'Writing as Unnamed. Change profile',
    })
    await expect(trigger).toHaveTextContent('Unnamed')
    await expect(trigger).not.toHaveTextContent('#')
    await userEvent.click(trigger)
    await expect(await canvas.findByRole('menuitemradio', { name: 'Ann' })).toBeVisible()
    await expect(canvas.getByRole('menuitemradio', { name: 'Unnamed' })).toBeVisible()
    await expect(document.body).not.toHaveTextContent('null')
    await expect(document.body).not.toHaveTextContent('#')
  },
}

/** 긴 이름(60자) — 메뉴 항목과 확인 단추 안에서 말줄임(줄을 밀어내지 않는다), 메뉴는 폭 상한이 있다. 전체 이름은 글자 그대로 남아 낭독 이름이다 */
const longName = '가나다라마바사아자차카타파하'.repeat(5).slice(0, 60)
export const LongNamesAreEllipsizedNotPushedOut: Story = {
  args: { remembered: 'prf_long', threadAuthorId: 'prf_a' },
  render: (args) => (
    <PickerDemo
      {...args}
      api={
        createFakeAuthorProfiles({
          profiles: [ann, { ...bea, id: 'prf_long', name: longName, tag: '0009' }],
        }).api
      }
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Writing as/ }))
    const menu = await canvas.findByRole('menu')
    await expect(menu.getBoundingClientRect().width).toBeLessThanOrEqual(
      parseFloat(getComputedStyle(document.documentElement).fontSize) * 24 + 2,
    ) // 폭 상한(24rem)
    const item = await canvas.findByRole('menuitemradio', { name: `${longName}#0009` }) // 전체 이름이 낭독 이름
    const box = menu.getBoundingClientRect()
    await expect(item.getBoundingClientRect().right).toBeLessThanOrEqual(box.right + 1) // 상자 안
    const name = item.querySelector<HTMLElement>('[class*="nameEllipsis"]')!
    const tag = item.querySelector<HTMLElement>('[class*="tagFixed"]')!
    await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth) // 이름이 잘렸다
    await expect(tag.scrollWidth).toBeLessThanOrEqual(tag.clientWidth) // 꼬리표는 온전하다
    await expect(tag).toHaveTextContent('#0009')
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth,
    ) // 문서 가로 스크롤 없음
  },
}

/** 확인 단추 안의 긴 이름도 이름만 말줄임이고 꼬리표는 고정이다 — 단추 이름(낭독)은 전체 */
export const LongNameInTheConfirmationButtonKeepsTheTag: Story = {
  args: { threadAuthorId: 'prf_a' },
  render: (args) => (
    <PickerDemo
      {...args}
      api={
        createFakeAuthorProfiles({
          profiles: [ann, { ...bea, id: 'prf_long', name: longName, tag: '0009' }],
        }).api
      }
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Writing as Ann#0001/ }))
    await userEvent.click(await canvas.findByRole('menuitemradio', { name: `${longName}#0009` }))
    const use = await canvas.findByRole('button', { name: `Use ${longName}#0009` })
    const name = use.querySelector<HTMLElement>('[class*="nameEllipsis"]')!
    const tag = use.querySelector<HTMLElement>('[class*="tagFixed"]')!
    await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth)
    await expect(tag.scrollWidth).toBeLessThanOrEqual(tag.clientWidth)
    await expect(use.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth)
  },
}

/** 확인 단추의 보이는 글자에서 문장과 이름 사이 공백이 살아 있다 — 「Use」 와 이름 상자 사이 간격이 0 보다 크다(공백이 접혀 「UseBea」 가 되지 않는다) */
export const ConfirmationButtonKeepsTheSpaceBeforeTheName: Story = {
  args: { threadAuthorId: 'prf_a' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Writing as Ann#0001/ }))
    await userEvent.click(await canvas.findByRole('menuitemradio', { name: 'Bea#0002' }))
    const use = await canvas.findByRole('button', { name: 'Use Bea#0002' })
    const name = use.querySelector<HTMLElement>('[class*="nameEllipsis"]')!
    const text = use.querySelector<HTMLElement>('[class*="buttonText"]')!.firstChild as Text
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 'Use'.length) // 「Use」 글자만
    const gap = name.getBoundingClientRect().left - range.getBoundingClientRect().right
    await expect(gap).toBeGreaterThan(0)
  },
}

/** 아주 좁은 칸(228px — 깊게 들여쓴 답글 폼 정도)에서 긴 이름으로 바꾸려 해도 확인 줄이 칸 밖으로 나가 가로 스크롤을 만들지 않는다 */
export const NarrowColumnKeepsTheConfirmationInside: Story = {
  args: { threadAuthorId: 'prf_a' },
  render: (args) => (
    <div data-narrow="" style={{ width: '228px' }}>
      <PickerDemo
        {...args}
        api={
          createFakeAuthorProfiles({
            profiles: [ann, { ...bea, id: 'prf_long', name: longName, tag: '0009' }],
          }).api
        }
      />
    </div>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const narrow = canvasElement.querySelector<HTMLElement>('[data-narrow]')!
    await userEvent.click(await canvas.findByRole('button', { name: /Writing as Ann#0001/ }))
    await userEvent.click(await canvas.findByRole('menuitemradio', { name: `${longName}#0009` }))
    await canvas.findByRole('button', { name: `Use ${longName}#0009` })
    await expect(narrow.scrollWidth).toBeLessThanOrEqual(narrow.clientWidth)
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth,
    )
  },
}
