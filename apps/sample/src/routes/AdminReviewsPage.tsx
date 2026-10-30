import { useCan } from '@skeleton/auth'
import { AdminReviewQueue } from '@skeleton/reviews/admin'
import { Link } from 'react-router-dom'
import { languageOf, useT } from '../i18n'
import { reviewsAdminApi } from '../reviews/api'
import { reviewsAdminLabelsFor } from '../reviews/labels'

/** 운영자 화면 - `AdminReviewQueue`(신고 큐 · 숨기기(사유 필수) · 문제없음 · 되살리기 · 답글). 백엔드 `review.moderate` · `review.reply`. 상품 칸은 상품 화면으로 잇는다 */
export function AdminReviewsPage() {
  const { locale } = useT()
  const language = languageOf(locale)
  const can = useCan()
  return (
    <AdminReviewQueue
      api={reviewsAdminApi}
      can={can}
      labels={reviewsAdminLabelsFor(language)}
      locale={language}
      renderTargetLink={(row, children) =>
        row.targetType === 'product' ? (
          <Link to={`/products/${encodeURIComponent(row.targetId)}`}>{children}</Link>
        ) : (
          children
        )
      }
    />
  )
}
