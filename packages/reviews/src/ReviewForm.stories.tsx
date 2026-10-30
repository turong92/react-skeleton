import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
import { koReviewsLabels } from './labels'
import { ReviewForm } from './ReviewForm'
import { PhotosDemo } from './stories/photosDemo'

/**
 * 리뷰 쓰기 · 고치기 — 별점(필수) + 본문(서버 한도) + 사진 칸. 사진 올리기는 이 패키지가 모른다:
 * 앱이 `renderPhotos` 에 `@skeleton/storage` 업로더를 꽂고 저장 키를 `onChange` 로 돌려준다(board 의 첨부 자리와 같은 방식).
 * 서버가 사진을 허용하지 않거나(`maxPhotos` 0) `renderPhotos` 가 없으면 사진 자리는 그려지지 않는다.
 * 보내는 일이 던지면 쓴 글은 그대로 남는다 - 오류 표시는 앱의 전역 핸들러.
 */
const meta = {
  title: 'Packages/reviews/ReviewForm',
  component: ReviewForm,
  parameters: { layout: 'padded' },
  args: {
    config: { bodyMinLength: 10, bodyMaxLength: 200, maxPhotos: 3 },
    labels: koReviewsLabels,
    onSubmit: fn(async () => undefined),
  },
} satisfies Meta<typeof ReviewForm>
export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('radio', { name: '4점' }))
    await userEvent.type(
      canvas.getByLabelText('리뷰 내용'),
      '  꼼꼼하게 만들어졌고 오래 쓸 것 같아요  ',
    )
    await userEvent.click(canvas.getByRole('button', { name: '리뷰 등록' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith({
        rating: 4,
        body: '꼼꼼하게 만들어졌고 오래 쓸 것 같아요',
      }),
    )
  },
}

export const ChecksBeforeSending: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '리뷰 등록' }))
    await expect(await canvas.findByText('별점을 골라 주세요.')).toBeVisible()
    await expect(canvas.getByRole('radio', { name: '1점' })).toHaveFocus()
    await userEvent.click(canvas.getByRole('radio', { name: '5점' }))
    await expect(canvas.queryByText('별점을 골라 주세요.')).toBeNull()
    await userEvent.type(canvas.getByLabelText('리뷰 내용'), '짧아요')
    await userEvent.click(canvas.getByRole('button', { name: '리뷰 등록' }))
    await expect(await canvas.findByText('10자 이상 적어 주세요.')).toBeVisible()
    await expect(canvas.getByLabelText('리뷰 내용')).toHaveFocus()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const TooLong: Story = {
  args: { config: { bodyMinLength: 1, bodyMaxLength: 5, maxPhotos: 0 } },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('radio', { name: '3점' }))
    await userEvent.type(canvas.getByLabelText('리뷰 내용'), '여섯 글자예요')
    await userEvent.click(canvas.getByRole('button', { name: '리뷰 등록' }))
    await expect(await canvas.findByText('5자 이내로 적어 주세요.')).toBeVisible()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const Edit: Story = {
  args: { initial: { rating: 4, body: '처음 쓴 리뷰예요. 괜찮았어요.' }, onCancel: fn() },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('radio', { name: '4점' })).toBeChecked()
    await expect(canvas.getByLabelText('리뷰 내용')).toHaveValue('처음 쓴 리뷰예요. 괜찮았어요.')
    await userEvent.click(canvas.getByRole('radio', { name: '5점' }))
    await userEvent.click(canvas.getByRole('button', { name: '수정 저장' }))
    // 사진 칸을 만지지 않았으니 photos 는 실리지 않는다 - 서버는 그대로 둔다
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith({
        rating: 5,
        body: '처음 쓴 리뷰예요. 괜찮았어요.',
      }),
    )
    await userEvent.click(canvas.getByRole('button', { name: '취소' }))
    await expect(args.onCancel).toHaveBeenCalled()
  },
}

export const WithPhotoSlotFromTheApp: Story = {
  args: { renderPhotos: (slot) => <PhotosDemo {...slot} /> },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('radio', { name: '5점' }))
    await userEvent.type(canvas.getByLabelText('리뷰 내용'), '사진도 같이 올려 봅니다 잘 나왔어요')
    await userEvent.click(canvas.getByRole('button', { name: '사진 추가' }))
    await expect(canvas.getByText('uploads/demo-1.jpg')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '리뷰 등록' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith({
        rating: 5,
        body: '사진도 같이 올려 봅니다 잘 나왔어요',
        photos: ['uploads/demo-1.jpg'],
      }),
    )
  },
}

export const KeepsWhatWasWrittenWhenSendingFails: Story = {
  args: {
    onSubmit: fn(async () => {
      throw new Error('server said no')
    }),
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('radio', { name: '2점' }))
    await userEvent.type(canvas.getByLabelText('리뷰 내용'), '서버가 거절해도 글은 남아야 해요')
    await userEvent.click(canvas.getByRole('button', { name: '리뷰 등록' }))
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled())
    await expect(canvas.getByLabelText('리뷰 내용')).toHaveValue('서버가 거절해도 글은 남아야 해요')
    await waitFor(() => expect(canvas.getByRole('button', { name: '리뷰 등록' })).toBeEnabled())
  },
}
