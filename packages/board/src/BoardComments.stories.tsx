import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { expect, fn, screen, waitFor, within } from 'storybook/test'
import { BoardComments } from './BoardComments'
import type { AuthorPicker } from './authorship'
import type { CommentInput } from './types'
import { demoAuthorPicker } from './stories/demoAuthorPicker'
import { createFakeBoard, type FakeBoardOptions } from './stories/fakeBoard'
import { WithQuery } from './stories/WithQuery'

/**
 * 댓글 영역(서버와 이어진 모양) — `api` 하나로 목록(최상위 단위 쪽 · 정렬) · 새 댓글 · 답글 · 수정 · 삭제(확인) · 운영자 숨김 · 반응(낙관적 갱신)을 한다.
 * 여기서는 메모리 안의 가짜 서버(`stories/fakeBoard.ts` — 계약의 규칙을 따른다)가 `api` 다. `config` 는 서버 설정(`useBoardConfig`)의 값.
 */
function Demo({
  fake,
  setup,
  watchCreate,
  hold,
  failFirstList,
  ...rest
}: {
  fake?: FakeBoardOptions
  /** 서버에 미리 깔아 둘 것(예: 내가 이 글에 이미 쓴 댓글) — 가짜 서버의 `newComment` 등 */
  setup?: (board: ReturnType<typeof createFakeBoard>) => void
  /** 댓글 만들기 요청이 서버로 갈 때마다 입력을 알린다(spy) */
  watchCreate?: (input: CommentInput) => void
  /**
   * 댓글 목록 요청을 붙잡아 둔다 — `first` 는 첫 요청, `later` 는 첫 요청 뒤의 요청들(쪽 · 정렬 바꾸기). 스토리가 `document` 에 `story:release` 를 보내면 풀린다
   * (시간이 아니라 신호로 — 느린 기계에서도 같은 순서)
   */
  hold?: 'first' | 'later'
  /** 첫 목록 요청을 서버 오류로 실패시킨다(첫 불러오기 실패) */
  failFirstList?: boolean
} & Partial<ComponentProps<typeof BoardComments>>) {
  const [{ api, board }] = useState(() => {
    const made = createFakeBoard(fake)
    setup?.(made)
    let listCalls = 0
    const gate = () =>
      new Promise<void>((resolve) =>
        document.addEventListener('story:release', () => resolve(), { once: true }),
      )
    const wrapped = {
      ...made.api,
      listComments: async (...args: Parameters<typeof made.api.listComments>) => {
        const call = listCalls++
        if (failFirstList && call === 0) throw new Error('offline')
        if ((hold === 'first' && call === 0) || (hold === 'later' && call > 0)) await gate()
        return made.api.listComments(...args)
      },
      createComment: (...args: Parameters<typeof made.api.createComment>) => {
        watchCreate?.(args[2])
        return made.api.createComment(...args)
      },
    }
    return { api: wrapped, board: made }
  })
  return (
    <WithQuery>
      <BoardComments
        api={api}
        boardCode="free"
        postId={3}
        config={board.config}
        currentUserId={fake?.me ?? 'me'}
        formatTime={() => '2026-01-01'}
        {...rest}
      />
    </WithQuery>
  )
}

/** 그 댓글의 반응 줄(자기 것 — 아래 답글의 줄은 제외) */
const reactionsOf = (root: HTMLElement, text: string) =>
  within(
    within(root)
      .getByText(text)
      .closest('[data-status]')!
      .querySelector<HTMLElement>('[role="group"]')!,
  )

const meta = {
  title: 'Packages/board/BoardComments',
  component: Demo,
} satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof meta>

export const ShowsTheTreeWithPlaceholders: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Spaces, always.')).toBeVisible()
    await expect(canvas.getByText('Tabs — they are accessible.')).toBeVisible()
    await expect(canvas.getByText('This comment was deleted.')).toBeVisible()
    await expect(canvas.getByText('This comment was hidden.')).toBeVisible()
    // 깊이 2 의 답글 둘은 접혀 있다
    await expect(canvas.queryByText('Agree with the formatter.')).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Show 2 more replies' })).toBeVisible()
  },
}

export const WriteACommentThenReplyAtEveryLevel: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Spaces, always.')
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Write a comment' }),
      'A new top-level one',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Post comment' }))
    await expect(await canvas.findByText('A new top-level one')).toBeVisible()
    await expect(canvas.getByRole('textbox', { name: 'Write a comment' })).toHaveValue('') // 보낸 뒤 비운다

    // 대댓글(깊이 1) — 자리에서 바로 보인다
    await userEvent.click(canvas.getByRole('button', { name: 'Reply: Me' }))
    await userEvent.type(canvas.getByRole('textbox', { name: 'Your reply' }), 'A reply of mine')
    await userEvent.click(canvas.getByRole('button', { name: 'Post reply' }))
    await expect(await canvas.findByText('A reply of mine')).toBeVisible()

    // 깊이 2 로 답하면 접힌 칸을 펼쳐 새 답글이 보인다
    await userEvent.click(canvas.getByRole('button', { name: 'Reply: Bob' }))
    await userEvent.type(canvas.getByRole('textbox', { name: 'Your reply' }), 'Deepest reply')
    await userEvent.click(canvas.getByRole('button', { name: 'Post reply' }))
    await expect(await canvas.findByText('Deepest reply')).toBeVisible()
    // 최대 깊이의 댓글에는 더 답할 수 없다
    await expect(canvas.queryByRole('button', { name: 'Reply: Carol' })).toBeNull()
  },
}

export const ReactionsAreOptimisticAndSingleModeSwitches: Story = {
  args: {
    fake: { types: ['LIKE', 'DISLIKE', 'EMPATHY'], delayMs: 250 },
    reactionLabels: { LIKE: '좋아요', DISLIKE: '싫어요', EMPATHY: '공감' },
    reactionIcons: { LIKE: '👍', DISLIKE: '👎', EMPATHY: '🤝' },
    labels: { reactionGroup: '반응' },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await canvas.findByText('Spaces, always.')
    const first = reactionsOf(canvasElement, 'Spaces, always.')
    await userEvent.click(first.getByRole('button', { name: '공감 0' }))
    // 서버가 답하기 전(250ms)에 이미 눌린 모양 · 개수 1
    await expect(first.getByRole('button', { name: '공감 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // 같은 댓글에서 다른 종류를 누르면(SINGLE) 옮겨 간다 — 새 종류 +1, 이전 종류 -1
    await userEvent.click(first.getByRole('button', { name: '좋아요 0' }))
    await expect(first.getByRole('button', { name: '좋아요 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(first.getByRole('button', { name: '공감 0' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    // 서버 응답이 와도 같은 값
    await waitFor(() => expect(first.getByRole('button', { name: '좋아요 1' })).toBeEnabled())
    // 다시 누르면 취소
    await userEvent.click(first.getByRole('button', { name: '좋아요 1' }))
    await expect(first.getByRole('button', { name: '좋아요 0' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  },
}

export const PerTypeModeKeepsSeveralReactions: Story = {
  args: {
    fake: { mode: 'PER_TYPE', types: ['LIKE', 'EMPATHY'] },
    reactionLabels: { EMPATHY: '공감' },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await canvas.findByText('Spaces, always.')
    const first = reactionsOf(canvasElement, 'Spaces, always.')
    await userEvent.click(first.getByRole('button', { name: 'LIKE 0' }))
    await userEvent.click(first.getByRole('button', { name: '공감 0' }))
    await expect(first.getByRole('button', { name: 'LIKE 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(first.getByRole('button', { name: '공감 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  },
}

export const AFailedReactionRollsBack: Story = {
  args: { fake: { delayMs: 200, failReactions: true } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await canvas.findByText('Spaces, always.')
    const first = reactionsOf(canvasElement, 'Spaces, always.')
    await userEvent.click(first.getByRole('button', { name: 'LIKE 0' }))
    await expect(first.getByRole('button', { name: 'LIKE 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    ) // 낙관적
    await waitFor(() =>
      expect(first.getByRole('button', { name: 'LIKE 0' })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    ) // 서버가 거절하자 되돌아간다
  },
}

export const OwnCommentEditThenDeleteWithConfirmation: Story = {
  args: { fake: { me: 'alice' } },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Spaces, always.')
    await userEvent.click(canvas.getByRole('button', { name: 'Edit: Alice' }))
    const box = canvas.getByRole('textbox', { name: 'Edit comment' })
    await userEvent.clear(box)
    await userEvent.type(box, 'Spaces, mostly.')
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    await expect(await canvas.findByText('Spaces, mostly.')).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: 'Delete: Alice' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete this comment?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await expect(canvas.getByText('Spaces, mostly.')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Delete: Alice' }))
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }),
    )
    await waitFor(() => expect(canvas.queryByText('Spaces, mostly.')).toBeNull())
    await expect(canvas.getAllByText('This comment was deleted.')).toHaveLength(2) // 지운 자리는 남는다
  },
}

export const ModeratorHidesAndRestores: Story = {
  args: { fake: { canModerate: true } },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Spaces, always.')
    await userEvent.click(canvas.getByRole('button', { name: 'Hide: Alice' }))
    await waitFor(() => expect(canvas.queryByText('Spaces, always.')).toBeNull())
    await userEvent.click(canvas.getByRole('button', { name: 'Restore: Alice' }))
    await expect(await canvas.findByText('Spaces, always.')).toBeVisible()
  },
}

export const NoModeratorButtonsForEveryoneElse: Story = {
  play: async ({ canvas }) => {
    await canvas.findByText('Spaces, always.')
    await expect(canvas.queryByRole('button', { name: /^(Hide|Restore)/ })).toBeNull()
  },
}

export const EmptyPost: Story = {
  args: { postId: 1 },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No comments yet.')).toBeVisible()
  },
}

export const Loading: Story = {
  args: { fake: { delayMs: 800 } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading')
    await expect(await canvas.findByText('Spaces, always.')).toBeVisible()
  },
}

export const KoreanLabels: Story = {
  args: {
    labels: {
      heading: '댓글',
      newComment: '댓글 쓰기',
      postComment: '댓글 등록',
      deleted: '삭제된 댓글입니다.',
    },
  },
  play: async ({ canvas }) => {
    await canvas.findByText('Spaces, always.')
    await expect(canvas.getByRole('heading', { name: '댓글' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: '댓글 등록' })).toBeVisible()
    await expect(canvas.getByText('삭제된 댓글입니다.')).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    await expect(await canvas.findByText('Spaces, always.')).toBeVisible()
  },
}

/** `beforeWrite` — 쓰기 직전에 앱이 막을 수 있다(예: 닉네임이 없으면 먼저 정하게). false 면 보내지 않고 쓴 글은 그대로 남는다 */
export const BeforeWriteCanBlockAndKeepsTheText: Story = {
  args: { beforeWrite: fn(() => false) },
  play: async ({ canvas, userEvent, args }) => {
    await canvas.findByText('Spaces, always.')
    const field = canvas.getByRole('textbox', { name: 'Write a comment' })
    await userEvent.type(field, 'Held back')
    await userEvent.click(canvas.getByRole('button', { name: 'Post comment' }))
    await waitFor(() => expect(args.beforeWrite).toHaveBeenCalled())
    await expect(field).toHaveValue('Held back')
    await expect(canvas.queryByText('Held back', { selector: 'p' })).toBeNull()
    // 답글도 같다
    await userEvent.click(canvas.getByRole('button', { name: 'Reply: Alice' }))
    await userEvent.type(canvas.getByRole('textbox', { name: 'Your reply' }), 'Held reply')
    await userEvent.click(canvas.getByRole('button', { name: 'Post reply' }))
    await expect(args.beforeWrite).toHaveBeenCalledTimes(2)
    await expect(canvas.getByRole('textbox', { name: 'Your reply' })).toHaveValue('Held reply')
  },
}

export const BeforeWriteThatAllowsPostsAsUsual: Story = {
  args: { beforeWrite: fn(() => true) },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Spaces, always.')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Write a comment' }), 'Allowed one')
    await userEvent.click(canvas.getByRole('button', { name: 'Post comment' }))
    await expect(await canvas.findByText('Allowed one')).toBeVisible()
  },
}

/** 한 쪽의 모든 댓글 줄기를 한 범위로 본다 — `AuthorScope` 로 감싸지 않아도 줄기가 달라도(같은 닉네임 · 다른 계정) 꼬리표가 붙는다 */
export const SameNicknameAcrossThreadsOfOnePageShowsTags: Story = {
  args: {
    fake: {
      nicknames: { alice: 'Sumin', erin: 'sumin', bob: 'Bob' },
      tags: { alice: '0001', erin: '0002', bob: '0003' },
    },
  },
  play: async ({ canvas }) => {
    await canvas.findByText('Spaces, always.')
    await expect(canvas.getAllByText('#0001').length).toBeGreaterThan(0)
    await expect(canvas.getAllByText('#0002').length).toBeGreaterThan(0)
    await expect(canvas.queryByText('#0003')).toBeNull() // Bob 은 겹치지 않는다
  },
}

/** 작성자 프로필을 쓰는 서버 — `authorRequired` 가 켜지고 쓰기에 `authorId` 가 필요하다. 계정(`me`) 아래 프로필 둘(`prf_a` · `prf_b`) */
const profileServer: FakeBoardOptions = {
  authorRequired: true,
  owned: ['prf_a', 'prf_b'],
  nicknames: {
    me: 'Me',
    alice: 'Alice',
    bob: 'Bob',
    carol: 'Carol',
    dave: 'Dave',
    admin: 'Admin',
    prf_a: 'Ann',
    prf_b: 'Bea',
  },
}

export const AuthorRequiredBlocksAnUnpickedComment: Story = {
  args: { fake: profileServer, authorPicker: demoAuthorPicker(), watchCreate: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await canvas.findByText('Spaces, always.')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Write a comment' }), 'As a profile')
    await userEvent.click(canvas.getByRole('button', { name: 'Post comment' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Choose who to post as.')
    await expect(canvas.getByRole('combobox', { name: 'Post as' })).toHaveFocus()
    await expect(canvas.getByRole('combobox', { name: 'Post as' })).toHaveAccessibleDescription(
      'Choose who to post as.',
    )
    await expect(canvas.queryByText('As a profile', { selector: 'p' })).toBeNull()
    await expect(args.watchCreate).not.toHaveBeenCalled() // 서버에 가지 않았다

    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Post as' }), 'Ann')
    await userEvent.click(canvas.getByRole('button', { name: 'Post comment' }))
    await expect(await canvas.findByText('As a profile', { selector: 'p' })).toBeVisible()
    await expect(args.watchCreate).toHaveBeenCalledWith({ body: 'As a profile', authorId: 'prf_a' })
  },
}

/** 답글 칸도 같다 — 고르지 않으면 막고(서버에 가지 않는다), 고르면 `authorId` 가 입력에 실려 간다 */
export const ReplyFormBlocksThenCarriesTheAuthorId: Story = {
  args: { fake: profileServer, authorPicker: demoAuthorPicker(), watchCreate: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await canvas.findByText('Spaces, always.')
    await userEvent.click(canvas.getByRole('button', { name: 'Reply: Alice' }))
    await userEvent.type(canvas.getByRole('textbox', { name: 'Your reply' }), 'Reply as Ann')
    await userEvent.click(canvas.getByRole('button', { name: 'Post reply' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Choose who to post as.')
    await expect(args.watchCreate).not.toHaveBeenCalled()

    const pickers = canvas.getAllByRole('combobox', { name: 'Post as' })
    await userEvent.selectOptions(pickers[1], 'Ann')
    await userEvent.click(canvas.getByRole('button', { name: 'Post reply' }))
    await expect(await canvas.findByText('Reply as Ann', { selector: 'p' })).toBeVisible()
    await expect(args.watchCreate).toHaveBeenCalledTimes(1)
    await expect(args.watchCreate).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Reply as Ann', authorId: 'prf_a' }),
    )
  },
}

/** 작성자 id(`prf_a`)는 계정 id(`me`)와 다르지만 서버가 `mine` 을 준다 — 수정 · 삭제 단추가 남는다 */
export const MineKeepsEditAndDeleteWhenTheAuthorIsNotTheAccount: Story = {
  args: { fake: profileServer, authorPicker: demoAuthorPicker() },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Spaces, always.')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Write a comment' }), 'Mine')
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Post as' }), 'Ann')
    await userEvent.click(canvas.getByRole('button', { name: 'Post comment' }))
    await expect(await canvas.findByText('Mine', { selector: 'p' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Edit: Ann' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Delete: Ann' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Edit: Alice' })).toBeNull()
  },
}

/** 이 글에 내가 이미 쓴 댓글(서버가 깔아 둔 `mine`)의 작성자가 선택기의 처음 값이다(`lastOwnAuthorId`) — 아무것도 누르기 전에. 댓글을 받는 동안은 확정하지 않는다 */
export const PickerStartsOnTheAuthorOfMyEarlierComment: Story = {
  args: {
    fake: profileServer,
    hold: 'first',
    authorPicker: demoAuthorPicker(),
    setup: (board) => {
      board.newComment(3, 'Written earlier as Bea', null, 'prf_b')
    },
  },
  play: async ({ canvas }) => {
    // 받는 중: 아직 모른다 — 비어 있다
    await expect(canvas.getByRole('combobox', { name: 'Post as' })).toHaveDisplayValue('Choose…')
    document.dispatchEvent(new Event('story:release'))
    await canvas.findByText('Written earlier as Bea', { selector: 'p' })
    await waitFor(() =>
      expect(canvas.getByRole('combobox', { name: 'Post as' })).toHaveDisplayValue('Bea'),
    )
  },
}

/**
 * 댓글을 받는 동안(`threadLoading`)에는 처음 값을 확정하지 않는다 — 단서(글 작성자 Ann)가 먼저 있어도 **Ann 을 거치지 않고**, 내 댓글(Bea)이 도착한 뒤 Bea 로 시작한다.
 * 선택기가 `onChange` 로 받은 값을 전부 센다(spy).
 */
const pickedSpy = fn()
const spyingPicker = demoAuthorPicker()
export const PickerNeverPassesThroughTheFallbackWhileLoading: Story = {
  beforeEach: () => pickedSpy.mockClear(),
  args: {
    fake: profileServer,
    hold: 'first',
    postAuthor: { authorId: 'prf_a', mine: true },
    setup: (board) => {
      board.newComment(3, 'Written earlier as Bea', null, 'prf_b')
    },
    authorPicker: (args) =>
      spyingPicker({
        ...args,
        onChange: (next) => {
          pickedSpy(next)
          args.onChange(next)
        },
      }),
  },
  play: async ({ canvas }) => {
    const picker = () => canvas.getByRole('combobox', { name: 'Post as' })
    await expect(picker()).toHaveDisplayValue('Choose…') // 받는 중: 비어 있다
    await expect(pickedSpy).not.toHaveBeenCalled() // 글 작성자(Ann)로도 채우지 않았다
    document.dispatchEvent(new Event('story:release'))
    await canvas.findByText('Written earlier as Bea', { selector: 'p' })
    await waitFor(() => expect(picker()).toHaveDisplayValue('Bea'))
    await expect(pickedSpy).toHaveBeenCalledTimes(1)
    await expect(pickedSpy).toHaveBeenCalledWith('prf_b') // Ann 을 거치지 않았다
  },
}

/** 이 글을 내가 쓰고 댓글은 아직 안 썼다 — 글의 `authorId`(`postAuthor`)가 단서다 */
export const PostAuthorIsTheFallbackClue: Story = {
  args: {
    fake: profileServer,
    authorPicker: demoAuthorPicker(),
    postAuthor: { authorId: 'prf_b', mine: true },
  },
  play: async ({ canvas }) => {
    await canvas.findByText('Spaces, always.')
    await waitFor(() =>
      expect(canvas.getByRole('combobox', { name: 'Post as' })).toHaveDisplayValue('Bea'),
    )
  },
}

/** 이 스레드에서 쓴 작성자가 선택기의 처음 값이 된다 — 방금 쓴 뒤의 새 댓글 칸 · 답글 칸이 모두 같다 */
export const PickerFollowsTheAuthorUsedInThisThread: Story = {
  args: { fake: profileServer, authorPicker: demoAuthorPicker() },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Spaces, always.')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Write a comment' }), 'First as Bea')
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Post as' }), 'Bea')
    await userEvent.click(canvas.getByRole('button', { name: 'Post comment' }))
    await canvas.findByText('First as Bea', { selector: 'p' })
    await userEvent.click(canvas.getByRole('button', { name: 'Reply: Alice' }))
    const pickers = canvas.getAllByRole('combobox', { name: 'Post as' })
    await expect(pickers).toHaveLength(2)
    await waitFor(() => expect(pickers[1]).toHaveDisplayValue('Bea'))
  },
}

/** 서버가 필수로 하지 않으면(`authorRequired` 없음) 선택기를 줘도 그리지 않는다 — 새 댓글 · 답글 모두 서버로 가는 입력에 `authorId` 키가 없다 */
export const PickerIsNotDrawnAndInputStaysBodyOnlyWithoutAuthorRequired: Story = {
  args: { authorPicker: demoAuthorPicker(), watchCreate: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await canvas.findByText('Spaces, always.')
    await expect(canvas.queryByRole('combobox', { name: 'Post as' })).toBeNull()
    await userEvent.type(canvas.getByRole('textbox', { name: 'Write a comment' }), 'Plain')
    await userEvent.click(canvas.getByRole('button', { name: 'Post comment' }))
    await expect(await canvas.findByText('Plain', { selector: 'p' })).toBeVisible()
    await expect(args.watchCreate).toHaveBeenCalledTimes(1)
    await expect(args.watchCreate).toHaveBeenCalledWith({ body: 'Plain' })
    await userEvent.click(canvas.getByRole('button', { name: 'Reply: Alice' }))
    await userEvent.type(canvas.getByRole('textbox', { name: 'Your reply' }), 'Plain reply')
    await userEvent.click(canvas.getByRole('button', { name: 'Post reply' }))
    await canvas.findByText('Plain reply', { selector: 'p' })
    await expect(args.watchCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({ body: 'Plain reply' }),
    )
    await expect(
      (args.watchCreate as ReturnType<typeof fn>).mock.calls.at(-1)?.[0],
    ).not.toHaveProperty('authorId')
  },
}

/** 배선을 고정하는 표지 — 선택기가 받은 `threadLoading` 을 DOM 에 드러낸다(선택기 안쪽은 보드가 모른다) */
const flagged = demoAuthorPicker()
const flaggedPicker: AuthorPicker = (args) => (
  <span data-thread-loading={String(args.threadLoading)}>{flagged(args)}</span>
)
const loadingFlag = (root: HTMLElement) =>
  root.querySelector('[data-thread-loading]')?.getAttribute('data-thread-loading')

/** 쪽 · 정렬을 바꾸는 사이 이전 쪽이 자리를 지키는 동안(placeholder)은 「아직 모름」이다 — 받는 중 표지가 켜졌다 꺼진다(`isPending` 만 보면 이 순간을 놓친다) */
export const PlaceholderPageCountsAsStillLoading: Story = {
  args: { fake: profileServer, hold: 'later', authorPicker: flaggedPicker },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await canvas.findByText('Spaces, always.')
    await waitFor(() => expect(loadingFlag(canvasElement)).toBe('false'))
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Sort comments' }), 'Latest')
    await waitFor(() => expect(loadingFlag(canvasElement)).toBe('true')) // 이전 쪽이 보이는 채
    await expect(canvas.getByText('Spaces, always.')).toBeVisible()
    document.dispatchEvent(new Event('story:release'))
    await waitFor(() => expect(loadingFlag(canvasElement)).toBe('false'))
  },
}

/** 첫 불러오기가 **실패**했다 — 「아직 모름」이 아니라 「실패」라 선택기는 잠기지 않는다(수동으로 고를 수 있다). 목록은 「다시 시도」를 가진다 */
export const FailedFirstLoadDoesNotLockThePicker: Story = {
  args: { fake: profileServer, failFirstList: true, authorPicker: flaggedPicker },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(await canvas.findByRole('button', { name: 'Try again' })).toBeVisible()
    await expect(loadingFlag(canvasElement)).toBe('false')
    const picker = canvas.getByRole('combobox', { name: 'Post as' })
    await expect(picker).toBeEnabled()
    await userEvent.selectOptions(picker, 'Ann')
    await expect(picker).toHaveDisplayValue('Ann')
  },
}

/** 선택기를 꽂지 않았는데 서버가 필수(`authorRequired`)로 하면 — 클라이언트가 막지 않는다(고를 수단이 없는 막다른 길). 서버가 400 으로 답하고 쓴 글은 남는다 */
export const AuthorRequiredWithoutAPickerIsLeftToTheServer: Story = {
  args: { fake: profileServer, watchCreate: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await canvas.findByText('Spaces, always.')
    await expect(canvas.queryByRole('combobox', { name: 'Post as' })).toBeNull()
    const field = canvas.getByRole('textbox', { name: 'Write a comment' })
    await userEvent.type(field, 'No picker')
    await userEvent.click(canvas.getByRole('button', { name: 'Post comment' }))
    await waitFor(() => expect(args.watchCreate).toHaveBeenCalledWith({ body: 'No picker' }))
    await expect(canvas.queryByText('Choose who to post as.')).toBeNull()
    await expect(field).toHaveValue('No picker')
  },
}
