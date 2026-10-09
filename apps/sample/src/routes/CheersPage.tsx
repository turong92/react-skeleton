import { OrderList } from '@skeleton/payment'
import { PageHeader } from '@skeleton/ui'
import { Link } from 'react-router-dom'
import { cheerAsOrder } from '../cheer/cheerAsOrder'
import { paymentLabelsFor } from '../cheer/paymentLabels'
import { useMyCheers } from '../cheer/queries'
import { LinkButton } from '../components/LinkButton'
import { languageOf, useT } from '../i18n'
import styles from './CheersPage.module.css'

export const CHEERS_PAGE_SIZE = 20

/**
 * Patterns/List page — 내 응원 내역(최신순, 커서로 더 보기). 줄마다 금액 · 시각 · (서버가 주면) 카드 · 눌리지 않는 상태 알약, 줄 끝에 「자세히」 링크가 결제 한 건(`/payments/:id`)으로 이어 준다.
 * 줄 전체는 눌리지 않는다. 내역이 없으면 비어 있다고 말하고 「응원하기」로 이어 준다.
 */
export function CheersPage() {
  const { t, locale } = useT()
  const language = languageOf(locale)
  const labels = paymentLabelsFor(t, language)
  const cheers = useMyCheers({ size: CHEERS_PAGE_SIZE })
  const rows = cheers.data?.pages.flatMap((page) => page.values) ?? []
  const cheerNow = <LinkButton to="/cheer">{t('cheer.history.cta')}</LinkButton>

  return (
    <div className={styles.page}>
      <PageHeader
        title={t('cheer.history.title')}
        description={t('cheer.history.subtitle')}
        actions={rows.length > 0 ? cheerNow : undefined}
      />
      <OrderList
        orders={rows.map((cheer) => cheerAsOrder(cheer, t('cheer.orderName')))}
        loading={cheers.isPending}
        error={cheers.isError}
        onRetry={() => void cheers.refetch()}
        onLoadMore={cheers.hasNextPage ? () => void cheers.fetchNextPage() : undefined}
        loadingMore={cheers.isFetchingNextPage}
        emptyAction={cheerNow}
        locale={language}
        labels={labels}
        renderAction={(order, label, accessibleName, buttonLikeClassName) => (
          <Link
            to={`/payments/${order.id}`}
            className={buttonLikeClassName}
            aria-label={accessibleName}
          >
            {label}
          </Link>
        )}
      />
    </div>
  )
}
