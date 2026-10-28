import { formatInstant } from '@skeleton/time'
import { Alert, Badge, Button, Field, Input, PageHeader, Skeleton, Stat, Table } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import { adminErrorMessage, isToolOff, mergeAdminLabels } from './adminErrors'
import type { RewardsAdminApi } from './adminApi'
import { useAccountPoints, useAdjustPoints } from './hooks'
import type { RewardsAdminLabels } from './labels'
import { allowAll, REWARDS_PERMISSIONS, type CanFn } from './permissions'
import styles from './AdminPoints.module.css'

export type AdminPointsProps = {
  api: Pick<RewardsAdminApi, 'accountPoints' | 'adjustPoints'>
  can?: CanFn
  labels?: Partial<RewardsAdminLabels>
  locale?: string
  formatTime?: (iso: string) => string
}

/** 포인트 운영 - 계정 id 로 찾아 잔액 · 내역을 보고, 사유와 함께 더하거나 뺀다. 잔액이 모자라면 서버가 409 `POINT.INSUFFICIENT`. 백엔드 `skeleton.point.admin.enabled=true` + `point.manage` */
export function AdminPoints({
  api,
  can = allowAll,
  labels: given,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
}: AdminPointsProps) {
  const labels = mergeAdminLabels(given)
  const t = labels.points
  const allowed = can(REWARDS_PERMISSIONS.point)
  const [draft, setDraft] = useState('')
  const [account, setAccount] = useState<string | null>(null)
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')
  const [days, setDays] = useState('')
  const query = useAccountPoints(api, account)
  const adjust = useAdjustPoints(api)
  const number = new Intl.NumberFormat(locale)
  const signed = new Intl.NumberFormat(locale, { signDisplay: 'exceptZero' })
  const amount = Math.trunc(Number(delta))
  const valid = account !== null && Number.isFinite(amount) && amount !== 0 && reason.trim() !== ''

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!valid || account === null) return
    adjust.mutate(
      {
        accountId: account,
        input: {
          delta: amount,
          reason: reason.trim(),
          expiresInDays: amount > 0 && days !== '' ? Math.max(1, Math.trunc(Number(days))) : null,
        },
      },
      {
        onSuccess: () => {
          setDelta('')
          setReason('')
          setDays('')
        },
      },
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader title={t.title} />
      <form
        className={styles.find}
        onSubmit={(event) => {
          event.preventDefault()
          adjust.reset()
          setAccount(draft.trim() || null)
        }}
      >
        <Field label={t.accountId}>
          {(control) => (
            <Input
              {...control}
              value={draft}
              autoComplete="off"
              onChange={(event) => setDraft(event.target.value)}
            />
          )}
        </Field>
        <Button type="submit" variant="secondary">
          {t.find}
        </Button>
      </form>
      {account !== null &&
        (query.isPending ? (
          <Skeleton label={labels.loading} />
        ) : query.isError ? (
          <Alert tone="danger">
            {isToolOff(query.error)
              ? labels.errors.notEnabled
              : adminErrorMessage(query.error, labels)}
          </Alert>
        ) : (
          <>
            <Stat label={t.balance} value={`${number.format(query.data.balance)} ${t.unit}`} />
            {allowed && (
              <form className={styles.adjust} onSubmit={submit} aria-label={t.adjust}>
                <h2>{t.adjust}</h2>
                {adjust.isError && (
                  <Alert tone="danger">{adminErrorMessage(adjust.error, labels)}</Alert>
                )}
                {adjust.isSuccess && <Alert tone="success">{t.done}</Alert>}
                <Field label={t.delta} hint={t.deltaHint}>
                  {(control) => (
                    <Input
                      {...control}
                      type="number"
                      value={delta}
                      onChange={(event) => setDelta(event.target.value)}
                    />
                  )}
                </Field>
                <Field label={t.reason}>
                  {(control) => (
                    <Input
                      {...control}
                      value={reason}
                      maxLength={200}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  )}
                </Field>
                {amount > 0 && (
                  <Field label={t.expiresInDays} hint={t.expiresInDaysHint}>
                    {(control) => (
                      <Input
                        {...control}
                        type="number"
                        min={1}
                        value={days}
                        onChange={(event) => setDays(event.target.value)}
                      />
                    )}
                  </Field>
                )}
                <div>
                  <Button
                    type="submit"
                    disabled={!valid}
                    loading={adjust.isPending}
                    loadingLabel={labels.loading}
                  >
                    {t.submit}
                  </Button>
                </div>
              </form>
            )}
            <div className={styles.history}>
              <h2>{t.history}</h2>
              <Table
                caption={t.history}
                rows={query.data.entries}
                rowKey={(entry) => entry.id}
                empty={<p className={styles.muted}>{t.emptyHistory}</p>}
                columns={[
                  {
                    key: 'when',
                    header: t.history,
                    rowHeader: true,
                    render: (entry) => formatTime(entry.createdAt),
                  },
                  {
                    key: 'kind',
                    header: t.adjust,
                    render: (entry) => <Badge>{t.kinds[entry.kind]}</Badge>,
                  },
                  { key: 'reason', header: t.reason, render: (entry) => entry.reason ?? '-' },
                  {
                    key: 'delta',
                    header: t.delta,
                    align: 'end',
                    render: (entry) => `${signed.format(entry.delta)} ${t.unit}`,
                  },
                ]}
              />
            </div>
          </>
        ))}
    </div>
  )
}
