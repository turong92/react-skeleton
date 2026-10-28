import { ApiRequestError, ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { formatDate } from '@skeleton/time'
import { Alert, Button, Card, Skeleton } from '@skeleton/ui'
import { defaultRewardsLabels, type RewardsLabels } from '../labels'
import type { CampaignApi } from './campaignApi'
import { useAttendance, useCheckIn } from './queries'
import styles from './AttendanceCard.module.css'

export type AttendanceCardProps = {
  api: Pick<CampaignApi, 'listCampaigns' | 'checkIn'>
  /** 출석 이벤트의 id (`GET /campaigns` 의 `kind: "attendance"` 항목) */
  campaignId: string
  labels?: RewardsLabels
  /** 이번 달에 출석한 날(`YYYY-MM-DD`) — `useAttendanceMonth` 로 받아 넘기면 날짜 줄이 생긴다 */
  monthDays?: readonly string[]
  formatDay?: (isoDate: string) => string
}

/** 출석 카드 — 「출석하기」 단추 하나(했으면 「오늘 출석함」 으로 잠긴다), 총 · 연속 일수, 다음 보상까지, 방금 받은 보상 */
export function AttendanceCard({
  api,
  campaignId,
  labels = defaultRewardsLabels,
  monthDays,
  formatDay = (isoDate) => formatDate(isoDate, { dateStyle: 'medium' }),
}: AttendanceCardProps) {
  const t = labels.attendance
  const query = useAttendance(api, campaignId)
  const checkIn = useCheckIn(api)

  if (query.isPending)
    return (
      <Card title={t.title}>
        <Skeleton lines={3} label={labels.loading} />
      </Card>
    )
  if (query.isError)
    return (
      <Card title={t.title}>
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
      </Card>
    )
  const campaign = query.data
  const state = campaign?.attendance
  if (!campaign || !state) return null

  const notActive =
    checkIn.error instanceof ApiRequestError &&
    isErrorCode(checkIn.error, ErrorCodes.CAMPAIGN_NOT_ACTIVE)
  const rewards = checkIn.data?.rewards ?? []

  return (
    <Card title={campaign.name}>
      <div className={styles.body}>
        <ul className={styles.stats}>
          <li>{t.total(state.total)}</li>
          <li>{t.streak(state.streak)}</li>
        </ul>
        <p className={styles.next}>
          {state.nextMilestone
            ? t.nextMilestone(state.nextMilestone.days, state.nextMilestone.streak)
            : t.noMilestone}
        </p>
        <Button
          variant={state.checkedToday ? 'secondary' : 'primary'}
          size="lg"
          disabled={state.checkedToday || notActive}
          loading={checkIn.isPending}
          loadingLabel={labels.loading}
          onClick={() => checkIn.mutate(campaignId)}
        >
          {state.checkedToday ? t.checkedToday : t.checkIn}
        </Button>
        {notActive && <Alert tone="warning">{t.notActive}</Alert>}
        {rewards.length > 0 && (
          <Alert tone="success" title={t.rewarded}>
            {rewards.map((reward) => reward.label).join(', ')}
          </Alert>
        )}
        {monthDays && monthDays.length > 0 && (
          <div>
            <p className={styles.monthTitle}>{t.monthDays(monthDays.length)}</p>
            <ul className={styles.days}>
              {monthDays.map((day) => (
                <li key={day} className={styles.day}>
                  <time dateTime={day}>{formatDay(day)}</time>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  )
}
