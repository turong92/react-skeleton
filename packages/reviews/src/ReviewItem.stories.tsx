import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, waitFor, within } from 'storybook/test'
import { koReviewsLabels } from './labels'
import { review } from './test/fixtures'
import { ReviewItem, type ReviewItemProps } from './ReviewItem'
import type { Review } from './types'

/**
 * 리뷰 한 줄 — 별 · 작성자#꼬리표 · 구매 인증 배지 · 본문(글자로만, HTML 아님) · 사진 칸 · 운영자 답글 · 「도움돼요 N」 단추 · ⋯ 메뉴.
 * 남의 리뷰의 ⋯ 는 「신고」(사유 창), 내 리뷰의 ⋯ 는 「수정」 · 「삭제」(확인 창). 도움돼요는 내 리뷰에는 숫자만 보인다(서버가 403).
 * 운영자가 숨긴 내 리뷰는 「숨겨졌어요 + 사유」 띠와 함께 나만 보이고, 고칠 수 없고 지울 수만 있다.
 * 사진은 저장 키가 응답에 없다 - `renderPhoto` 로 앱이 `photoPath(id, index)` 를 그린다(기본은 이름표만).
 */
const meta = {
  title: 'Packages/reviews/ReviewItem',
  component: ReviewItem,
  parameters: { layout: 'padded' },
  args: {
    review: review('r1', {
      verified: true,
      helpfulCount: 3,
      rating: 4,
      body: '배송이 빠르고 포장이 꼼꼼했어요.',
    }),
    labels: koReviewsLabels,
    locale: 'ko-KR',
  },
} satisfies Meta<typeof ReviewItem>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: '5점 만점에 4점' })).toBeVisible()
    await expect(canvas.getByText('Ada#0001')).toBeVisible()
    await expect(canvas.getByText('구매 인증')).toBeVisible()
    await expect(canvas.getByText('3명에게 도움이 됐어요')).toBeVisible()
  },
}

export const PhotosAndReply: Story = {
  args: {
    review: review('r2', {
      photos: [{ index: 0 }, { index: 1 }],
      reply: {
        body: '소중한 후기 감사합니다.',
        createdAt: '2026-10-29T01:00:00Z',
        updatedAt: '2026-10-29T01:00:00Z',
      },
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('list', { name: '사진' })).toBeVisible()
    await expect(canvas.getByText('사진 2')).toBeVisible()
    await expect(canvas.getByRole('region', { name: '운영자 답글' })).toBeVisible()
    await expect(canvas.getByText('소중한 후기 감사합니다.')).toBeVisible()
  },
}

export const BodyIsTextNotHtml: Story = {
  args: { review: review('r3', { body: '<b>굵게</b><script>alert(1)</script>' }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('<b>굵게</b><script>alert(1)</script>')).toBeVisible()
    await expect(canvas.queryByText('굵게', { selector: 'b' })).toBeNull()
  },
}

const HelpfulDemo = (args: ReviewItemProps) => {
  const [current, setCurrent] = useState<Review>(args.review)
  return (
    <ReviewItem
      {...args}
      review={current}
      onToggleHelpful={(_, helpful) =>
        setCurrent((r) => ({ ...r, helpful, helpfulCount: r.helpfulCount + (helpful ? 1 : -1) }))
      }
    />
  )
}

export const HelpfulToggles: Story = {
  render: (args) => <HelpfulDemo {...args} />,
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: '도움돼요 3' })
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)
    const pressed = canvas.getByRole('button', { name: '✓ 도움돼요 4' })
    await expect(pressed).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(pressed)
    await expect(canvas.getByRole('button', { name: '도움돼요 3' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  },
}

export const HelpfulOnMyOwnReviewIsOnlyTheCount: Story = {
  args: { review: review('r4', { mine: true, helpfulCount: 2 }), onToggleHelpful: fn() },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button', { name: /도움돼요/ })).toBeNull()
    await expect(canvas.getByText('2명에게 도움이 됐어요')).toBeVisible()
  },
}

export const ReportDialogFlow: Story = {
  args: { onReport: fn(async () => undefined) },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Ada#0001 님의 리뷰 더보기' }))
    await userEvent.click(await canvas.findByRole('menuitem', { name: '신고' }))
    const dialog = within(await canvas.findByRole('dialog', { name: '리뷰 신고' }))
    // 사유 없이 보내면 막히고 이유를 말한다
    await userEvent.click(dialog.getByRole('button', { name: '신고하기' }))
    await expect(await dialog.findByText('사유를 골라 주세요.')).toBeVisible()
    await expect(args.onReport).not.toHaveBeenCalled()
    await userEvent.click(dialog.getByRole('radio', { name: '스팸 · 광고' }))
    await userEvent.type(dialog.getByLabelText(/자세한 내용/), '  링크를 달아 놨어요  ')
    await userEvent.click(dialog.getByRole('button', { name: '신고하기' }))
    await waitFor(() =>
      expect(args.onReport).toHaveBeenCalledWith(args.review, {
        reason: 'SPAM',
        detail: '링크를 달아 놨어요',
      }),
    )
    await expect(await canvas.findByText('신고했어요. 확인해 볼게요.')).toBeVisible()
  },
}

export const MyReviewMenuHasEditAndDelete: Story = {
  args: {
    review: review('r5', { mine: true, authorName: 'Me', authorTag: null }),
    onEdit: fn(),
    onDelete: fn(async () => undefined),
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Me 님의 리뷰 더보기' }))
    await expect(await canvas.findByRole('menuitem', { name: '수정' })).toBeVisible()
    await expect(canvas.queryByRole('menuitem', { name: '신고' })).toBeNull()
    await userEvent.click(canvas.getByRole('menuitem', { name: '수정' }))
    await expect(args.onEdit).toHaveBeenCalledWith(args.review)
  },
}

export const DeleteAsksFirst: Story = {
  args: {
    review: review('r6', { mine: true, authorName: 'Me', authorTag: null }),
    onDelete: fn(async () => undefined),
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Me 님의 리뷰 더보기' }))
    await userEvent.click(await canvas.findByRole('menuitem', { name: '삭제' }))
    await expect(args.onDelete).not.toHaveBeenCalled()
    const dialog = within(await canvas.findByRole('dialog', { name: '리뷰를 지울까요?' }))
    await userEvent.click(dialog.getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(args.onDelete).toHaveBeenCalledWith(args.review))
  },
}

export const HiddenByTheTeam: Story = {
  args: {
    review: review('r7', {
      mine: true,
      authorName: 'Me',
      authorTag: null,
      status: 'HIDDEN',
      moderationReason: '광고성 내용이 포함되어 있어요',
    }),
    onEdit: fn(),
    onDelete: fn(),
    onToggleHelpful: fn(),
  },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText(/이 리뷰는 숨겨졌어요/)).toBeVisible()
    await expect(canvas.getByText('사유: 광고성 내용이 포함되어 있어요')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /도움돼요/ })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Me 님의 리뷰 더보기' }))
    await expect(await canvas.findByRole('menuitem', { name: '삭제' })).toBeVisible()
    await expect(canvas.queryByRole('menuitem', { name: '수정' })).toBeNull()
  },
}

export const DeletedAuthor: Story = {
  args: { review: review('r8', { authorDeleted: true, authorName: null, authorTag: null }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('탈퇴한 사용자')).toBeVisible()
  },
}
