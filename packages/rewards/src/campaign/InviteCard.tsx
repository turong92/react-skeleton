import { Alert, Button, Card, CopyButton, Skeleton } from '@skeleton/ui'
import { defaultRewardsLabels, type RewardsLabels } from '../labels'
import type { CampaignApi } from './campaignApi'
import { useReferral } from './queries'
import styles from './InviteCard.module.css'

export type InviteCardProps = {
  api: Pick<CampaignApi, 'myReferral'>
  labels?: RewardsLabels
  /** 복사할 글자를 코드 대신 링크로 — 예: `(code) => \`${origin}/signup?ref=${code}\`` (받는 쪽은 `useReferralCapture`) */
  shareText?: (code: string) => string
}

/** 친구 초대 카드 — 내 코드(복사 단추), 초대한 사람 수 · 보상받은 사람 수 */
export function InviteCard({ api, labels = defaultRewardsLabels, shareText }: InviteCardProps) {
  const t = labels.invite
  const query = useReferral(api)
  if (query.isPending)
    return (
      <Card title={t.title}>
        <Skeleton lines={2} label={labels.loading} />
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
  const { code, invited, rewarded } = query.data
  return (
    <Card title={t.title}>
      <div className={styles.body}>
        <p className={styles.description}>{t.description}</p>
        <div className={styles.codeRow}>
          <span className={styles.codeLabel}>{t.yourCode}</span>
          <strong className={styles.code}>{code}</strong>
          <CopyButton
            value={shareText ? shareText(code) : code}
            label={t.copy}
            copiedLabel={t.copied}
            failedLabel={t.copyFailed}
          />
        </div>
        <ul className={styles.stats}>
          <li>{t.invited(invited)}</li>
          <li>{t.rewarded(rewarded)}</li>
        </ul>
      </div>
    </Card>
  )
}
