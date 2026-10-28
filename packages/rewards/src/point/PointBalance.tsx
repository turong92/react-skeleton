import { formatInstant } from '@skeleton/time'
import { Alert, Button, Skeleton, Stat } from '@skeleton/ui'
import { defaultRewardsLabels, type RewardsLabels } from '../labels'
import type { PointApi } from './pointApi'
import { usePoints } from './queries'

export type PointBalanceProps = {
  api: Pick<PointApi, 'points'>
  labels?: RewardsLabels
  locale?: string
  formatTime?: (iso: string) => string
}

/** 포인트 잔액 한 칸 — 곧 소멸할 포인트가 있으면 아래에 안내 */
export function PointBalance({
  api,
  labels = defaultRewardsLabels,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
}: PointBalanceProps) {
  const t = labels.point
  const query = usePoints(api)
  const number = new Intl.NumberFormat(locale)
  if (query.isPending) return <Skeleton lines={2} label={labels.loading} />
  if (query.isError)
    return (
      <Alert
        tone="danger"
        action={
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            {labels.retry}
          </Button>
        }
      >
        {labels.loadFailed}
      </Alert>
    )
  const { balance, expiringSoon } = query.data
  return (
    <Stat
      label={t.balance}
      value={`${number.format(balance)} ${t.unit}`}
      hint={
        expiringSoon && expiringSoon.amount > 0
          ? t.expiringSoon(
              `${number.format(expiringSoon.amount)} ${t.unit}`,
              formatTime(expiringSoon.before),
            )
          : undefined
      }
      tone={expiringSoon && expiringSoon.amount > 0 ? 'warning' : 'neutral'}
    />
  )
}
