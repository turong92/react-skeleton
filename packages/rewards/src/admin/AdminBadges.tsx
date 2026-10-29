import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Skeleton,
  Table,
  Textarea,
} from '@skeleton/ui'
import { useId, useState, type FormEvent } from 'react'
import { BadgeTile } from '../badge/BadgeTile'
import type { RewardsAdminApi } from './adminApi'
import { accountLabelOf, type AccountChoice } from './accountLabel'
import { AccountSearch } from './AccountSearch'
import { adminErrorMessage, isToolOff, mergeAdminLabels } from './adminErrors'
import { BADGE_CODE } from './badgeRows'
import { useAdminBadges, useBadgeMutations } from './hooks'
import type { RewardsAdminLabels } from './labels'
import { allowAll, REWARDS_PERMISSIONS, type CanFn } from './permissions'
import type { AdminBadge, BadgeAwardResult } from './types'
import styles from './AdminBadges.module.css'

/** 서버 한도 - 수동 수여 한 번에 계정 100개 */
const MAX_AWARD_ACCOUNTS = 100

export type AdminBadgesProps = {
  api: Pick<
    RewardsAdminApi,
    'listBadges' | 'createBadge' | 'updateBadge' | 'setBadgeStatus' | 'awardBadge'
  >
  /** 글자로 계정을 찾는다(수동 수여에서 쓴다) - 앱이 준다. 없으면 「수동 수여」 단추가 없다 */
  searchAccounts?: (query: string) => Promise<AccountChoice[]>
  /** 권한 질문 - 단추를 숨긴다(서버가 다시 판정한다). 기본 모두 허용 */
  can?: CanFn
  labels?: Partial<RewardsAdminLabels>
}

type Draft = {
  code: string
  name: string
  description: string
  imageUrl: string
  hidden: boolean
  sortOrder: string
}

const draftOf = (badge: AdminBadge | null): Draft => ({
  code: badge?.code ?? '',
  name: badge?.name ?? '',
  description: badge?.description ?? '',
  imageUrl: badge?.imageUrl ?? '',
  hidden: badge?.hidden ?? false,
  sortOrder: String(badge?.sortOrder ?? 0),
})

/**
 * 배지 운영 - 목록(보유자 수) · 만들기 / 고치기(고칠 때 코드는 잠긴다) · 보관 / 되살리기 · 수동 수여.
 * 백엔드 `skeleton.badge.admin.enabled=true` + `badge.manage`. 회수는 `AdminBadgeAwards`(내역)에서 한다
 */
export function AdminBadges({
  api,
  searchAccounts,
  can = allowAll,
  labels: given,
}: AdminBadgesProps) {
  const labels = mergeAdminLabels(given)
  const t = labels.badges
  const allowed = can(REWARDS_PERMISSIONS.badge)
  const list = useAdminBadges(api)
  const mutations = useBadgeMutations(api)
  const [editing, setEditing] = useState<AdminBadge | 'new' | null>(null)
  const [awarding, setAwarding] = useState<AdminBadge | null>(null)
  const failure = mutations.create.error ?? mutations.update.error

  return (
    <div className={styles.page}>
      <PageHeader
        title={t.title}
        actions={
          allowed && (
            <Button onClick={() => setEditing('new')} disabled={!list.data}>
              {t.create}
            </Button>
          )
        }
      />
      {mutations.setStatus.isError && (
        <Alert tone="danger">{adminErrorMessage(mutations.setStatus.error, labels)}</Alert>
      )}
      {list.isPending ? (
        <Skeleton label={labels.loading} />
      ) : list.isError ? (
        <Alert
          tone="danger"
          action={
            isToolOff(list.error) ? undefined : (
              <Button variant="secondary" size="sm" onClick={() => void list.refetch()}>
                {labels.retry}
              </Button>
            )
          }
        >
          {isToolOff(list.error) ? labels.errors.notEnabled : labels.loadFailed}
        </Alert>
      ) : (
        <Table
          caption={t.caption}
          rows={list.data}
          rowKey={(b) => b.id}
          empty={<EmptyState title={t.empty} headingLevel={2} />}
          columns={[
            {
              key: 'badge',
              header: t.columns.badge,
              rowHeader: true,
              render: (b) => (
                <span className={styles.badgeCell}>
                  <BadgeTile state="earned" size="sm" name={b.name} imageUrl={b.imageUrl} />
                  <span className={styles.muted}>
                    {b.code}
                    {b.hidden && ` · ${t.hiddenTag}`}
                  </span>
                </span>
              ),
            },
            { key: 'holders', header: t.columns.holders, render: (b) => b.holders },
            {
              key: 'status',
              header: t.columns.status,
              render: (b) => (
                <Badge tone={b.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {t.status[b.status]}
                </Badge>
              ),
            },
            {
              key: 'actions',
              header: t.columns.actions,
              render: (b) =>
                allowed && (
                  <span className={styles.actions}>
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`${labels.edit}: ${b.name}`}
                      onClick={() => setEditing(b)}
                    >
                      {labels.edit}
                    </Button>
                    {searchAccounts && b.status === 'ACTIVE' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={t.awardFor(b.name)}
                        onClick={() => setAwarding(b)}
                      >
                        {t.award}
                      </Button>
                    )}
                    <Button
                      variant={b.status === 'ACTIVE' ? 'danger' : 'secondary'}
                      size="sm"
                      aria-label={
                        b.status === 'ACTIVE' ? t.archiveFor(b.name) : t.restoreFor(b.name)
                      }
                      loading={
                        mutations.setStatus.isPending && mutations.setStatus.variables?.id === b.id
                      }
                      loadingLabel={labels.loading}
                      onClick={() =>
                        mutations.setStatus.mutate({
                          id: b.id,
                          status: b.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE',
                        })
                      }
                    >
                      {b.status === 'ACTIVE' ? t.archive : t.restore}
                    </Button>
                  </span>
                ),
            },
          ]}
        />
      )}
      {editing !== null && (
        <BadgeDialog
          key={editing === 'new' ? 'new' : editing.id}
          badge={editing === 'new' ? null : editing}
          labels={labels}
          busy={mutations.create.isPending || mutations.update.isPending}
          error={failure ? adminErrorMessage(failure, labels) : null}
          onClose={() => {
            mutations.create.reset()
            mutations.update.reset()
            setEditing(null)
          }}
          onSubmit={(draft) => {
            const input = {
              name: draft.name.trim(),
              description: draft.description.trim(),
              imageUrl: draft.imageUrl.trim() === '' ? null : draft.imageUrl.trim(),
              hidden: draft.hidden,
              sortOrder: Math.trunc(Number(draft.sortOrder) || 0),
            }
            const done = { onSuccess: () => setEditing(null) }
            if (editing === 'new') mutations.create.mutate({ code: draft.code, ...input }, done)
            else mutations.update.mutate({ id: editing.id, input }, done)
          }}
        />
      )}
      {awarding && searchAccounts && (
        <AwardDialog
          badge={awarding}
          labels={labels}
          searchAccounts={searchAccounts}
          busy={mutations.award.isPending}
          result={mutations.award.data ?? null}
          error={mutations.award.isError ? adminErrorMessage(mutations.award.error, labels) : null}
          onClose={() => {
            mutations.award.reset()
            setAwarding(null)
          }}
          onSubmit={(accountIds, reason) =>
            mutations.award.mutate({ id: awarding.id, accountIds, reason })
          }
        />
      )}
    </div>
  )
}

function BadgeDialog({
  badge,
  labels,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  badge: AdminBadge | null
  labels: RewardsAdminLabels
  busy: boolean
  error: string | null
  onClose: () => void
  onSubmit: (draft: Draft) => void
}) {
  const t = labels.badges
  const formId = useId()
  const [draft, setDraft] = useState<Draft>(() => draftOf(badge))
  const patch = (next: Partial<Draft>) => setDraft((now) => ({ ...now, ...next }))
  const codeOk = badge !== null || BADGE_CODE.test(draft.code)
  const valid = codeOk && draft.name.trim() !== ''
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (valid) onSubmit(draft)
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title={badge ? t.editTitle(badge.name) : t.createTitle}
      closeLabel={labels.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {labels.cancel}
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={!valid}
            loading={busy}
            loadingLabel={labels.loading}
          >
            {labels.save}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit}>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field
          label={t.code}
          hint={t.codeHint}
          required
          error={draft.code !== '' && !codeOk ? t.codeHint : undefined}
        >
          {(control) => (
            <Input
              {...control}
              value={draft.code}
              disabled={badge !== null}
              maxLength={64}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => patch({ code: event.target.value })}
            />
          )}
        </Field>
        <Field label={t.name} required>
          {(control) => (
            <Input
              {...control}
              value={draft.name}
              maxLength={100}
              onChange={(event) => patch({ name: event.target.value })}
            />
          )}
        </Field>
        <Field label={t.description}>
          {(control) => (
            <Textarea
              {...control}
              value={draft.description}
              maxLength={500}
              onChange={(event) => patch({ description: event.target.value })}
            />
          )}
        </Field>
        <Field label={t.imageUrl} hint={t.imageUrlHint}>
          {(control) => (
            <Input
              {...control}
              value={draft.imageUrl}
              maxLength={500}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => patch({ imageUrl: event.target.value })}
            />
          )}
        </Field>
        <Checkbox
          label={t.hidden}
          description={t.hiddenHint}
          checked={draft.hidden}
          onChange={(event) => patch({ hidden: event.target.checked })}
        />
        <Field label={t.sortOrder}>
          {(control) => (
            <Input
              {...control}
              type="number"
              value={draft.sortOrder}
              onChange={(event) => patch({ sortOrder: event.target.value })}
            />
          )}
        </Field>
      </form>
    </Dialog>
  )
}

function AwardDialog({
  badge,
  labels,
  searchAccounts,
  busy,
  result,
  error,
  onClose,
  onSubmit,
}: {
  badge: AdminBadge
  labels: RewardsAdminLabels
  searchAccounts: (query: string) => Promise<AccountChoice[]>
  busy: boolean
  result: BadgeAwardResult | null
  error: string | null
  onClose: () => void
  onSubmit: (accountIds: string[], reason?: string) => void
}) {
  const t = labels.badges
  // 계정은 검색해서 하나씩 골라 담는다(계정 id 를 직접 적는 칸은 없다)
  const [chosen, setChosen] = useState<AccountChoice[]>([])
  const [reason, setReason] = useState('')
  const pick = (account: AccountChoice) =>
    setChosen((now) =>
      now.some((a) => a.id === account.id) || now.length >= MAX_AWARD_ACCOUNTS
        ? now
        : [...now, account],
    )
  return (
    <Dialog
      open
      onClose={onClose}
      title={t.awardTitle(badge.name)}
      closeLabel={labels.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {labels.cancel}
          </Button>
          <Button
            loading={busy}
            loadingLabel={labels.loading}
            disabled={chosen.length === 0}
            onClick={() =>
              onSubmit(
                chosen.map((a) => a.id),
                reason.trim() || undefined,
              )
            }
          >
            {t.award}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        {error && <Alert tone="danger">{error}</Alert>}
        {result && (
          <Alert tone={result.awarded.length > 0 ? 'success' : 'warning'}>
            {t.awardedResult(result.awarded.length, result.alreadyHeld.length)}
          </Alert>
        )}
        <AccountSearch search={searchAccounts} onPick={pick} labels={labels} />
        <section aria-label={t.awardAccounts}>
          <h3 className={styles.chosenTitle}>{t.awardAccounts}</h3>
          {chosen.length === 0 ? (
            <p className={styles.muted}>{t.awardHint}</p>
          ) : (
            <ul className={styles.chosen}>
              {chosen.map((account) => (
                <li key={account.id} className={styles.chip}>
                  <span>{accountLabelOf(account)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`${labels.remove}: ${accountLabelOf(account)}`}
                    onClick={() => setChosen((now) => now.filter((a) => a.id !== account.id))}
                  >
                    {labels.remove}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {chosen.length >= MAX_AWARD_ACCOUNTS && (
            <p className={styles.muted}>{t.awardLimit(MAX_AWARD_ACCOUNTS)}</p>
          )}
        </section>
        <Field label={t.reason} hint={t.reasonHint}>
          {(control) => (
            <Input
              {...control}
              value={reason}
              maxLength={200}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </Field>
      </div>
    </Dialog>
  )
}
