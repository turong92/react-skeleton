import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { koReviewsAdminLabels } from './labels'
import { ReviewReplyEditor } from './ReviewReplyEditor'

/** 운영자 답글 폼 — 리뷰당 하나, 있으면 그 자리에서 고친다. 삭제는 확인 창 뒤에 */
const meta = {
  title: 'Packages/reviews/admin/ReviewReplyEditor',
  component: ReviewReplyEditor,
  parameters: { layout: 'padded' },
  args: {
    labels: koReviewsAdminLabels,
    reply: null,
    onSave: fn(async () => undefined),
    onRemove: fn(async () => undefined),
  },
} satisfies Meta<typeof ReviewReplyEditor>
export default meta
type Story = StoryObj<typeof meta>

export const NewReplyNeedsText: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: '답글 저장' }))
    await expect(await canvas.findByText('답글을 적어 주세요.')).toBeVisible()
    await expect(args.onSave).not.toHaveBeenCalled()
    await userEvent.type(canvas.getByLabelText(/^답글/), '  감사합니다  ')
    await userEvent.click(canvas.getByRole('button', { name: '답글 저장' }))
    await expect(args.onSave).toHaveBeenCalledWith('감사합니다')
    await expect(canvas.queryByRole('button', { name: '답글 삭제' })).toBeNull()
  },
}

export const EditsTheExistingReply: Story = {
  args: {
    reply: {
      body: '감사합니다',
      createdAt: '2026-10-29T01:00:00Z',
      updatedAt: '2026-10-29T01:00:00Z',
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText(/^답글/)).toHaveValue('감사합니다')
    await expect(canvas.getByRole('button', { name: '답글 삭제' })).toBeVisible()
  },
}
