import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState, type ComponentProps } from 'react'
import { expect, fn, waitFor } from 'storybook/test'
import { createFakeAuthorProfiles } from './stories/fakeAuthorProfiles'
import { createMemoryStorage } from './stories/memoryStorage'
import { PickerDemo } from './stories/PickerDemo'
import { profile } from './test/fixtures'

/**
 * 작성자 선택기와 **이 스레드**(`AuthorPicker` 의 나머지) — 처음 값 ① 이 스레드에서 쓴 프로필이 ② 기기 기억을 이기고, 댓글을 받는 중(`threadLoading`)에는 확정하지 않고 단추를 잠근다.
 * 이 스레드에서 쓴 프로필과 **다른 것으로 바꿀 때만** 한 줄 확인이 나온다(「Keep ○○」 의 ○○ 는 **지금 고른** 프로필). 확인은 Esc · 바깥 포커스 · 잠금 · 값 변화로 닫힌다.
 */
const ann = profile('prf_a', 'Ann', '0001')
const bea = profile('prf_b', 'Bea', '0002')
const cy = profile('prf_c', 'Cy', '0003')
const storage = createMemoryStorage()
const onChange = fn()

/**
 * 밖에서 바뀌는 props — 시간이 아니라 **신호**로 바꾼다(스토리가 `document` 에 `story:settle`(댓글을 다 받음) · `story:lock`(보내는 중)을 보낸다).
 * 이 신호는 포커스 · 누르기가 아니라서 떠 있는 확인을 건드리지 않는다.
 */
function Changing({
  loadingAtStart,
  ...rest
}: ComponentProps<typeof PickerDemo> & { loadingAtStart?: boolean }) {
  const [loading, setLoading] = useState(loadingAtStart === true)
  const [sending, setSending] = useState(false)
  useEffect(() => {
    const settle = () => setLoading(false)
    const lock = () => setSending(true)
    document.addEventListener('story:settle', settle)
    document.addEventListener('story:lock', lock)
    return () => {
      document.removeEventListener('story:settle', settle)
      document.removeEventListener('story:lock', lock)
    }
  }, [])
  return <PickerDemo {...rest} threadLoading={loading} disabled={sending} />
}

const meta = {
  title: 'Packages/author-profile/AuthorPicker thread',
  component: Changing,
  parameters: { layout: 'centered' },
  args: {
    api: createFakeAuthorProfiles({ profiles: [ann, bea] }).api,
    storage,
    onChange,
  },
  render: (args) => (
    <Changing {...args} api={createFakeAuthorProfiles({ profiles: [ann, bea] }).api} />
  ),
  beforeEach: () => {
    storage.reset()
    onChange.mockClear()
  },
} satisfies Meta<typeof Changing>
export default meta
type Story = StoryObj<typeof meta>

export const ThisThreadBeatsTheDeviceMemory: Story = {
  args: { remembered: 'prf_b', threadAuthorId: 'prf_a' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: /Writing as Ann#0001/ })).toBeVisible()
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('prf_a'))
  },
}

/** 댓글을 받는 중에는 확정하지 않는다 — 기기 기억이 있어도 비어 있고, 단추는 잠겨 「불러오는 중」을 말한다. 다 받으면 이 스레드의 프로필이 이긴다(기억을 거치지 않는다) */
export const WaitsWhileTheThreadIsLoadingThenTheThreadWins: Story = {
  args: { remembered: 'prf_b', threadAuthorId: 'prf_a', loadingAtStart: true },
  play: async ({ canvas }) => {
    const waiting = await canvas.findByRole('button', { name: 'Loading this thread' })
    await expect(waiting).toHaveAttribute('aria-disabled', 'true')
    await expect(waiting).toHaveTextContent('Loading this thread')
    await expect(onChange).not.toHaveBeenCalled() // 기기 기억(Bea)으로 넘어가지 않았다
    document.dispatchEvent(new Event('story:settle')) // 댓글을 다 받았다
    await expect(await canvas.findByRole('button', { name: /Writing as Ann#0001/ })).toBeVisible()
    await expect(onChange).toHaveBeenCalledTimes(1)
    await expect(onChange).toHaveBeenCalledWith('prf_a')
  },
}

export const FormErrorIsTheTriggersDescription: Story = {
  args: { invalid: true, describedBy: 'author-error' },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('button', { name: 'Choose a profile' }),
    ).toHaveAccessibleDescription('Choose who to post as.')
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
    await expect(canvas.getByRole('button', { name: /Writing as Ann#0001/ })).toHaveFocus()

    // 다시 골라 확인
    await userEvent.click(canvas.getByRole('button', { name: /Writing as Ann#0001/ }))
    await userEvent.click(await canvas.findByRole('menuitemradio', { name: 'Bea#0002' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Use Bea#0002' }))
    await expect(await canvas.findByRole('button', { name: /Writing as Bea#0002/ })).toHaveFocus()
    await expect(canvas.queryByRole('status')).toBeNull()
    await expect(Object.values(storage.dump())).toEqual(['prf_b'])
  },
}

/** 프로필이 셋일 때 「유지」 는 **지금 고른** 프로필이다 — 이 스레드의 프로필(Ann)이 아니라 지금 값(Cy). 눌러도 값은 그대로 */
export const KeepNamesTheCurrentValueNotTheThreadProfile: Story = {
  args: { threadAuthorId: 'prf_a' },
  render: (args) => (
    <Changing {...args} api={createFakeAuthorProfiles({ profiles: [ann, bea, cy] }).api} />
  ),
  play: async ({ canvas, userEvent }) => {
    // 이 스레드의 Ann 으로 시작 → Cy 로 바꾼다(확인 거침)
    await userEvent.click(await canvas.findByRole('button', { name: /Writing as Ann#0001/ }))
    await userEvent.click(await canvas.findByRole('menuitemradio', { name: 'Cy#0003' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Use Cy#0003' }))
    await expect(await canvas.findByRole('button', { name: /Writing as Cy#0003/ })).toBeVisible()

    // 이제 Bea 를 고르면: 이 스레드는 Ann, 지금 값은 Cy
    await userEvent.click(canvas.getByRole('button', { name: /Writing as Cy#0003/ }))
    await userEvent.click(await canvas.findByRole('menuitemradio', { name: 'Bea#0002' }))
    await expect(await canvas.findByRole('status')).toHaveTextContent(
      'You wrote in this thread as Ann#0001.',
    )
    await expect(canvas.getByRole('button', { name: 'Use Bea#0002' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Keep Ann#0001' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Keep Cy#0003' }))
    await expect(canvas.queryByRole('status')).toBeNull()
    await expect(canvas.getByRole('button', { name: /Writing as Cy#0003/ })).toHaveFocus()
  },
}

/** 한 줄 확인은 한 번만 읽힌다 — 문장은 `role="status"` 하나뿐이고(같은 글을 한 번 더 읽는 묶음 이름이 없다), Esc 는 닫고 포커스를 선택기 단추로 돌린다 */
export const NoticeIsAnnouncedOnceAndEscapeClosesIt: Story = {
  args: { threadAuthorId: 'prf_a' },
  play: async ({ canvas, userEvent }) => {
    const trigger = await canvas.findByRole('button', { name: /Writing as Ann#0001/ })
    await userEvent.click(trigger)
    await userEvent.click(await canvas.findByRole('menuitemradio', { name: 'Bea#0002' }))
    await expect(await canvas.findByRole('status')).toBeVisible()
    await expect(canvas.getAllByRole('status')).toHaveLength(1)
    await expect(canvas.queryByRole('group')).toBeNull()
    // 메뉴에서 고른 직후의 실제 포커스(선택기 단추)에서 Esc — 확인 줄로 포커스를 옮기지 않는다
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(canvas.queryByRole('status')).toBeNull())
    await expect(trigger).toHaveFocus()
    await expect(trigger).toHaveTextContent('Ann#0001') // 값은 그대로
  },
}

/** 확인이 떠 있는데 바깥으로 포커스가 가면 낡은 질문이라 닫힌다(고르지도 유지하지도 않고 떠난 것) */
export const NoticeClosesWhenFocusLeaves: Story = {
  args: { threadAuthorId: 'prf_a' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Writing as Ann#0001/ }))
    await userEvent.click(await canvas.findByRole('menuitemradio', { name: 'Bea#0002' }))
    await expect(await canvas.findByRole('status')).toBeVisible()
    canvas.getByRole('button', { name: 'Send' }).focus() // 선택기 밖
    await waitFor(() => expect(canvas.queryByRole('status')).toBeNull())
    await expect(canvas.getByRole('button', { name: /Writing as Ann#0001/ })).toBeVisible() // 값은 그대로
  },
}

/** 확인이 떠 있는데 보내는 중(`disabled`)이 되면 닫힌다 — 잠긴 폼 옆에 응답할 수 없는 질문이 남지 않는다 */
export const NoticeClosesWhenTheFormGetsLocked: Story = {
  args: { threadAuthorId: 'prf_a' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Writing as Ann#0001/ }))
    await userEvent.click(await canvas.findByRole('menuitemradio', { name: 'Bea#0002' }))
    await expect(await canvas.findByRole('status')).toBeVisible()
    document.dispatchEvent(new Event('story:lock')) // 보내는 중
    await waitFor(() => expect(canvas.queryByRole('status')).toBeNull())
    await expect(canvas.getByRole('button', { name: /Writing as Ann#0001/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  },
}
