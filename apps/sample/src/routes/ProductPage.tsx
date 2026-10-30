import { useAuth } from '@skeleton/auth'
import { useCatalogProducts } from '@skeleton/payment'
import {
  ReviewForm,
  ReviewList,
  ReviewSummary,
  useCreateReview,
  useReviewConfig,
  useReviewFilters,
  useReviewSummary,
  useUpdateReview,
  writeBlockedMessage,
  type Review,
  type ReviewTarget,
  type TargetSummary,
} from '@skeleton/reviews'
import { Alert, Card, Dialog, PageHeader, Spinner } from '@skeleton/ui'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PicturePicker } from '../board/Pictures'
import { catalogApi, QUIET_CATALOG } from '../catalog/api'
import { LinkButton } from '../components/LinkButton'
import { LoadError } from '../components/LoadError'
import { languageOf, useT } from '../i18n'
import { textOf } from '../landing/catalogPricing'
import { reviewsApi } from '../reviews/api'
import { reviewsLabelsFor } from '../reviews/labels'
import { ReviewPhoto } from '../reviews/ReviewPhoto'
import { NotFoundPage } from './NotFoundPage'
import styles from './ProductPage.module.css'

/** 리뷰 쓰기 칸의 사진 칸 — 올리기는 `@skeleton/storage` 업로더(게시판과 같은 `PicturePicker`), 폼에는 저장 키만 남는다 */
const renderPhotos = ({
  photos,
  onChange,
  max,
}: {
  photos: string[]
  onChange: (k: string[]) => void
  max: number
}) => <PicturePicker value={photos} onChange={onChange} max={max} />

/** 쓰기 칸 — 로그인한 사람만 그린다(`GET /reviews/config` 가 로그인을 요구한다). 쓸 수 없으면 까닭 문장 */
function WriteArea({ target, summary }: { target: ReviewTarget; summary: TargetSummary }) {
  const { locale } = useT()
  const labels = reviewsLabelsFor(languageOf(locale))
  const config = useReviewConfig(reviewsApi)
  const create = useCreateReview(reviewsApi, target)
  const blocked = writeBlockedMessage(summary.writeBlockedReason, labels)
  if (summary.canWrite && config.data)
    return (
      <Card title={labels.form.submit}>
        <ReviewForm
          config={config.data}
          labels={labels}
          renderPhotos={renderPhotos}
          onSubmit={(input) => create.mutateAsync({ input })}
        />
      </Card>
    )
  return blocked ? <Alert tone="info">{blocked}</Alert> : null
}

/**
 * 내 리뷰 고치기 창 — 서버가 작성자 본인 줄에 사진 저장 키(`photo.key`)를 주므로 기존 사진이 사진 칸에 그대로 들어 있다:
 * 유지 · 하나만 빼기 · 더하기가 된다. 칸을 만졌을 때만 PATCH 에 `photos` 가 실리고(전체 교체), 안 만지면 서버가 그대로 둔다.
 * 키가 없는 응답(옛 서버)이면 기존 사진을 읽기용으로만 보이고, 칸을 만지면 모두 바뀐다고 알린다 - 말없이 지워지지 않게.
 */
function EditDialog({ review, onClose }: { review: Review; onClose: () => void }) {
  const { t, locale } = useT()
  const labels = reviewsLabelsFor(languageOf(locale))
  const config = useReviewConfig(reviewsApi)
  const update = useUpdateReview(reviewsApi)
  const keys = review.photos.flatMap((photo) => (photo.key ? [photo.key] : []))
  const keyed = keys.length === review.photos.length
  return (
    <Dialog open onClose={onClose} title={labels.item.edit} closeLabel={labels.item.close}>
      {config.data && (
        <ReviewForm
          config={config.data}
          labels={labels}
          initial={{
            rating: review.rating,
            body: review.body,
            ...(keyed ? { photos: keys } : {}),
          }}
          renderPhotos={(slot) =>
            keyed ? (
              renderPhotos(slot)
            ) : (
              <div className={styles.editPhotos}>
                <ul className={styles.existing} aria-label={labels.item.photos}>
                  {review.photos.map((photo) => (
                    <li key={photo.index}>
                      <ReviewPhoto
                        path={reviewsApi.photoPath(review.id, photo.index)}
                        alt={labels.item.photo(photo.index + 1)}
                      />
                    </li>
                  ))}
                </ul>
                <p className={styles.hint}>{t('reviews.edit.photosReplace')}</p>
                {renderPhotos(slot)}
              </div>
            )
          }
          onCancel={onClose}
          onSubmit={async (input) => {
            await update.mutateAsync({ id: review.id, patch: input })
            onClose()
          }}
        />
      )}
    </Dialog>
  )
}

/** 상품의 리뷰 구역 — 요약 막대와 목록이 거르기 조건 한 벌을 나눠 쓴다(`ReviewsPage` 스토리와 같은 조립) */
function ProductReviews({ target }: { target: ReviewTarget }) {
  const { t, locale } = useT()
  const language = languageOf(locale)
  const labels = reviewsLabelsFor(language)
  const { status } = useAuth()
  const signedIn = status === 'authenticated'
  const filters = useReviewFilters()
  const summary = useReviewSummary(reviewsApi, target)
  const [editing, setEditing] = useState<Review | null>(null)

  return (
    <section className={styles.reviews} aria-labelledby="product-reviews">
      <h2 id="product-reviews">{t('products.reviews')}</h2>
      {summary.data && (
        <ReviewSummary
          summary={summary.data}
          rating={filters.params.rating}
          onToggleRating={filters.toggleRating}
          labels={labels}
        />
      )}
      {summary.data &&
        (signedIn ? (
          <WriteArea target={target} summary={summary.data} />
        ) : (
          <div className={styles.signIn}>
            <p>{writeBlockedMessage('SIGN_IN', labels)}</p>
            <LinkButton to="/login" variant="secondary">
              {t('header.signIn')}
            </LinkButton>
          </div>
        ))}
      <ReviewList
        api={reviewsApi}
        target={target}
        labels={labels}
        filters={filters}
        signedIn={signedIn}
        onEdit={setEditing}
        renderPhoto={(photo, review) => (
          <ReviewPhoto
            path={reviewsApi.photoPath(review.id, photo.index)}
            alt={labels.item.photo(photo.index + 1)}
          />
        )}
        locale={language}
        emptyHeadingLevel={3}
      />
      {editing && <EditDialog review={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

/**
 * 상품 화면(`/products/:code`) — 공개 카탈로그(`GET /catalog/products`)에서 상품을 찾아 이름 · 설명을 보이고, 그 아래 리뷰 구역.
 * 로그인하지 않아도 열린다(리뷰 읽기는 서버 `allow-anonymous-read`). 카탈로그에 없는 코드는 404 화면.
 */
export function ProductPage() {
  const { t, locale } = useT()
  const { code = '' } = useParams()
  const catalog = useCatalogProducts(catalogApi, undefined, QUIET_CATALOG)

  if (catalog.isPending) return <Spinner label={t('common.loading')} />
  if (catalog.isError)
    return <LoadError error={catalog.error} onRetry={() => void catalog.refetch()} />
  const product = catalog.data.products.find((p) => p.code === code)
  if (!product) return <NotFoundPage />
  const text = textOf(product, languageOf(locale))
  return (
    <div className={styles.page}>
      <PageHeader
        back={<Link to="/">← {t('products.back')}</Link>}
        title={text.name}
        description={text.description ?? undefined}
      />
      <ProductReviews target={{ type: 'product', id: product.code }} />
    </div>
  )
}
