import type { Meta, StoryObj } from '@storybook/react-vite'
import { Alert, Card, PageHeader } from '@skeleton/ui'
import { expect, waitFor } from 'storybook/test'
import { koReviewsLabels } from './labels'
import { useReviewFilters } from './filters'
import { useCreateReview, useReviewConfig, useReviewSummary } from './queries'
import { ReviewForm } from './ReviewForm'
import { ReviewList } from './ReviewList'
import { ReviewSummary } from './ReviewSummary'
import { createFakeReviews, type FakeReviewsOptions } from './stories/fakeReviews'
import { PhotosDemo } from './stories/photosDemo'
import { WithQuery } from './stories/WithQuery'
import { writeBlockedMessage } from './writeBlocked'
import type { ReviewsApi } from './reviewsApi'

/**
 * 상품 상세 안의 리뷰 구역 - 한 화면이 이렇게 조립된다(복사해서 시작한다):
 * `useReviewFilters()` 를 위에서 한 번 만들어 `ReviewSummary`(분포 막대)와 `ReviewList` 에 건네고,
 * 서버가 `summary.canWrite` 로 쓸 수 있다고 하면 `ReviewForm`, 아니면 `writeBlockedMessage(summary.writeBlockedReason)` 문장을 보여 준다.
 * 사진 칸은 앱이 `renderPhotos` 로 꽂는다(여기서는 데모).
 */
const target = { type: 'product', id: 'sku-1' }

function Section({ api, signedIn = true }: { api: ReviewsApi; signedIn?: boolean }) {
  const filters = useReviewFilters()
  const config = useReviewConfig(api)
  const summary = useReviewSummary(api, target)
  const create = useCreateReview(api, target)
  if (!summary.data || !config.data) return null
  const blocked = writeBlockedMessage(summary.data.writeBlockedReason, koReviewsLabels)
  return (
    <div style={{ display: 'grid', gap: 'var(--space-xl)' }}>
      <PageHeader title="리뷰" />
      <ReviewSummary
        summary={summary.data}
        rating={filters.params.rating}
        onToggleRating={filters.toggleRating}
        labels={koReviewsLabels}
      />
      {signedIn && summary.data.canWrite ? (
        <Card>
          <ReviewForm
            config={config.data}
            labels={koReviewsLabels}
            renderPhotos={(slot) => <PhotosDemo {...slot} />}
            onSubmit={(input) => create.mutateAsync({ input })}
          />
        </Card>
      ) : (
        blocked && <Alert tone="info">{blocked}</Alert>
      )}
      <ReviewList
        api={api}
        target={target}
        labels={koReviewsLabels}
        filters={filters}
        signedIn={signedIn}
        reportReasons={config.data.reportReasons}
        locale="ko-KR"
        emptyHeadingLevel={2}
      />
    </div>
  )
}

type Args = FakeReviewsOptions & { signedIn?: boolean }
const meta = {
  title: 'Packages/reviews/ReviewsPage',
  parameters: { layout: 'padded' },
  render: ({ signedIn, ...options }: Args) => {
    const { api } = createFakeReviews(options)
    return (
      <WithQuery>
        <Section api={api} signedIn={signedIn} />
      </WithQuery>
    )
  },
} satisfies Meta<Args>
export default meta
type Story = StoryObj<typeof meta>

export const BarFiltersTheList: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findAllByRole('article')
    const bar = await canvas.findByRole('button', { name: /^1점 \d+개, 이 별점만 보기$/ })
    await userEvent.click(bar)
    await waitFor(() => expect(canvas.getAllByRole('article').length).toBeGreaterThan(0))
    await waitFor(async () => {
      for (const article of canvas.getAllByRole('article'))
        await expect(article.querySelector('[role="img"]')).toHaveAttribute(
          'aria-label',
          '5점 만점에 1점',
        )
    })
    await expect(canvas.getByRole('button', { name: '✓ 1점' })).toBeVisible()
  },
}

export const NothingMatchesTheFilters: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findAllByRole('article')
    // 1점 리뷰는 있지만 사진이 붙은 1점은 없다
    await userEvent.click(
      await canvas.findByRole('button', { name: /^1점 \d+개, 이 별점만 보기$/ }),
    )
    await userEvent.click(canvas.getByRole('button', { name: '사진 리뷰' }))
    await expect(await canvas.findByText('조건에 맞는 리뷰가 없어요.')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '거르기 풀기', hidden: false }))
    await waitFor(() => expect(canvas.getAllByRole('article').length).toBeGreaterThan(0))
  },
}

export const WriteAReviewThenItAppearsAndTheAverageMoves: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findAllByRole('article')
    await userEvent.click(await canvas.findByRole('radio', { name: '5점' }))
    await userEvent.type(canvas.getByLabelText('리뷰 내용'), '새로 써 본 리뷰입니다 아주 좋아요')
    await userEvent.click(canvas.getByRole('button', { name: '리뷰 등록' }))
    await expect(await canvas.findByText('새로 써 본 리뷰입니다 아주 좋아요')).toBeVisible()
    // 이제 쓸 수 없다 - 이미 썼다
    await expect(await canvas.findByText('이미 리뷰를 썼어요. 고쳐 쓸 수 있어요.')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '리뷰 등록' })).toBeNull()
  },
}

export const OnlyBuyersCanWrite: Story = {
  args: { blocked: 'PURCHASE_REQUIRED' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('구매한 분만 쓸 수 있어요')).toBeVisible()
    await expect(canvas.queryByLabelText('리뷰 내용')).toBeNull()
  },
}

export const MyReviewWasHidden: Story = {
  args: { hiddenMine: true },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/이 리뷰는 숨겨졌어요/)).toBeVisible()
    await expect(canvas.getByText('운영자가 숨긴 리뷰라 다시 쓸 수 없어요.')).toBeVisible()
  },
}

export const NoReviewsYet: Story = {
  args: { empty: true },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('아직 리뷰가 없어요')).toBeVisible()
    await expect(await canvas.findByText('아직 리뷰가 없어요.')).toBeVisible()
  },
}

export const SignedOutSeesReviewsButCannotWrite: Story = {
  args: { signedIn: false, blocked: 'SIGN_IN' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('로그인하면 리뷰를 쓸 수 있어요.')).toBeVisible()
    await expect(canvas.queryByLabelText('리뷰 내용')).toBeNull()
  },
}
