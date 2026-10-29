import { formatInstant } from '@skeleton/time'
import {
  Alert,
  Button,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Switch,
  Table,
  Checkbox,
} from '@skeleton/ui'
import { useId, useState, type FormEvent } from 'react'
import type { RewardsAdminApi } from './adminApi'
import { adminErrorMessage, isToolOff, mergeAdminLabels } from './adminErrors'
import {
  achievementProblems,
  hasAchievementProblem,
  MAX_ACHIEVEMENT_STEPS,
} from './achievementDraft'
import { fromLocalInput, toLocalInput } from './dateInput'
import { useAdminCampaigns, useCampaignMutations } from './hooks'
import type { RewardsAdminLabels } from './labels'
import { allowAll, REWARDS_PERMISSIONS, type CanFn } from './permissions'
import { RewardListEditor, type BadgeChoice, type CouponChoice } from './RewardListEditor'
import type {
  AchievementStepConfig,
  AdminCampaign,
  AttendanceMilestoneConfig,
  CampaignConfig,
  RewardConfig,
} from './types'
import styles from './AdminCampaigns.module.css'

export type AdminCampaignsProps = {
  api: Pick<
    RewardsAdminApi,
    'listCampaigns' | 'createCampaign' | 'updateCampaign' | 'setCampaignEnabled'
  >
  /** 쿠폰 보상에서 고를 쿠폰 정의(`useAdminCouponDefinitions` 의 이름 목록) */
  couponChoices?: readonly CouponChoice[]
  /** 배지 보상에서 고를 배지(`badge` 모듈이 있는 앱) - 없으면 코드를 직접 적는다 */
  badgeChoices?: readonly BadgeChoice[]
  /** 권한 질문 - 단추를 숨긴다(서버가 다시 판정한다). 기본 모두 허용 */
  can?: CanFn
  labels?: Partial<RewardsAdminLabels>
  locale?: string
  formatTime?: (iso: string) => string
}

type Draft = {
  kind: AdminCampaign['kind']
  name: string
  startsAt: string
  endsAt: string
  config: CampaignConfig
}

const emptyDraft = (): Draft => ({
  kind: 'attendance',
  name: '',
  startsAt: toLocalInput(new Date().toISOString()),
  endsAt: '',
  config: { daily: [], milestones: [] },
})

/** 업적 단계의 첫 보상 줄 - 비어 있는 채로 저장하지 못하게 처음부터 한 줄을 깔아 둔다 */
const blankReward = (): RewardConfig => ({ type: 'point', params: { amount: '' } })

const configFor = (kind: Draft['kind']): CampaignConfig =>
  kind === 'attendance'
    ? { daily: [], milestones: [] }
    : kind === 'achievement'
      ? { metric: '', milestones: [{ value: 1, rewards: [blankReward()] }] }
      : { invitee: [], inviter: [], qualifyOn: 'SIGNAL', claimWithinDays: 7, inviterCap: null }

/** 이벤트 운영 - 목록, 켜고 끄는 스위치, 만들기 · 고치기(종류별 설정 + 보상 목록). 백엔드 `skeleton.campaign.admin.enabled=true` + `campaign.manage` */
export function AdminCampaigns({
  api,
  couponChoices,
  badgeChoices,
  can = allowAll,
  labels: given,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
}: AdminCampaignsProps) {
  const labels = mergeAdminLabels(given)
  const t = labels.campaigns
  const allowed = can(REWARDS_PERMISSIONS.campaign)
  const list = useAdminCampaigns(api)
  const mutations = useCampaignMutations(api)
  const [editing, setEditing] = useState<AdminCampaign | 'new' | null>(null)

  const failure = mutations.setEnabled.error ?? mutations.create.error ?? mutations.update.error

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
      {mutations.setEnabled.isError && (
        <Alert tone="danger">{adminErrorMessage(mutations.setEnabled.error, labels)}</Alert>
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
          rowKey={(c) => c.id}
          empty={<EmptyState title={t.empty} headingLevel={2} />}
          columns={[
            { key: 'name', header: t.columns.name, rowHeader: true, render: (c) => c.name },
            { key: 'kind', header: t.columns.kind, render: (c) => t.kinds[c.kind] },
            {
              key: 'period',
              header: t.columns.period,
              render: (c) =>
                `${formatTime(c.startsAt)} ~ ${c.endsAt ? formatTime(c.endsAt) : t.noEnd}`,
            },
            {
              key: 'enabled',
              header: t.columns.enabled,
              render: (c) => (
                <Switch
                  label={t.enabledSwitch(c.name)}
                  checked={c.enabled}
                  disabled={!allowed || mutations.setEnabled.isPending}
                  onChange={(event) =>
                    mutations.setEnabled.mutate({ id: c.id, enabled: event.target.checked })
                  }
                />
              ),
            },
            {
              key: 'actions',
              header: t.columns.actions,
              render: (c) =>
                allowed && (
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`${labels.edit}: ${c.name}`}
                    onClick={() => setEditing(c)}
                  >
                    {labels.edit}
                  </Button>
                ),
            },
          ]}
        />
      )}
      {editing !== null && (
        <CampaignDialog
          key={editing === 'new' ? 'new' : editing.id}
          campaign={editing === 'new' ? null : editing}
          labels={labels}
          couponChoices={couponChoices}
          badgeChoices={badgeChoices}
          busy={mutations.create.isPending || mutations.update.isPending}
          error={failure && editing !== null ? adminErrorMessage(failure, labels) : null}
          onClose={() => {
            mutations.create.reset()
            mutations.update.reset()
            setEditing(null)
          }}
          onSubmit={(draft) => {
            const common = {
              name: draft.name.trim(),
              startsAt: fromLocalInput(draft.startsAt) ?? new Date().toISOString(),
              endsAt: fromLocalInput(draft.endsAt),
              config: draft.config,
            }
            const done = { onSuccess: () => setEditing(null) }
            if (editing === 'new') mutations.create.mutate({ kind: draft.kind, ...common }, done)
            else mutations.update.mutate({ id: editing.id, input: common }, done)
          }}
        />
      )}
    </div>
  )
}

function CampaignDialog({
  campaign,
  labels,
  couponChoices,
  badgeChoices,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  campaign: AdminCampaign | null
  labels: RewardsAdminLabels
  couponChoices?: readonly CouponChoice[]
  badgeChoices?: readonly BadgeChoice[]
  busy: boolean
  error: string | null
  onClose: () => void
  onSubmit: (draft: Draft) => void
}) {
  const t = labels.campaigns
  const formId = useId()
  const [draft, setDraft] = useState<Draft>(() =>
    campaign
      ? {
          kind: campaign.kind,
          name: campaign.name,
          startsAt: toLocalInput(campaign.startsAt),
          endsAt: toLocalInput(campaign.endsAt),
          config: campaign.config,
        }
      : emptyDraft(),
  )
  const patch = (next: Partial<Draft>) => setDraft((now) => ({ ...now, ...next }))
  const config = (next: Partial<CampaignConfig>) =>
    setDraft((now) => ({ ...now, config: { ...now.config, ...next } }))
  const milestones = (draft.config.milestones ?? []) as AttendanceMilestoneConfig[]
  const steps = (draft.config.milestones ?? []) as AchievementStepConfig[]
  const setStep = (index: number, next: Partial<AchievementStepConfig>) =>
    config({ milestones: steps.map((s, i) => (i === index ? { ...s, ...next } : s)) })
  const setMilestone = (index: number, next: Partial<AttendanceMilestoneConfig>) =>
    config({ milestones: milestones.map((m, i) => (i === index ? { ...m, ...next } : m)) })
  const problems = draft.kind === 'achievement' ? achievementProblems(draft.config) : null
  const blocked = problems !== null && hasAchievementProblem(problems)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!blocked) onSubmit(draft)
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title={campaign ? t.editTitle(campaign.name) : t.createTitle}
      closeLabel={labels.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {labels.cancel}
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={blocked}
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
        <Field label={t.kind}>
          {(control) => (
            <Select
              {...control}
              value={draft.kind}
              disabled={campaign !== null}
              onChange={(event) => {
                const kind = event.target.value as Draft['kind']
                patch({ kind, config: configFor(kind) })
              }}
            >
              <option value="attendance">{t.kinds.attendance}</option>
              <option value="referral">{t.kinds.referral}</option>
              <option value="achievement">{t.kinds.achievement}</option>
            </Select>
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
        <Field label={t.startsAt}>
          {(control) => (
            <Input
              {...control}
              type="datetime-local"
              value={draft.startsAt}
              onChange={(event) => patch({ startsAt: event.target.value })}
            />
          )}
        </Field>
        <Field label={t.endsAt} hint={t.endsAtHint}>
          {(control) => (
            <Input
              {...control}
              type="datetime-local"
              value={draft.endsAt}
              onChange={(event) => patch({ endsAt: event.target.value })}
            />
          )}
        </Field>
        {draft.kind === 'achievement' ? (
          <>
            <Field
              label={t.achievement.metric}
              hint={t.achievement.metricHint}
              required
              error={
                problems?.metric && (draft.config.metric ?? '') !== ''
                  ? t.achievement.errors.metric
                  : undefined
              }
            >
              {(control) => (
                <Input
                  {...control}
                  value={draft.config.metric ?? ''}
                  maxLength={64}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => config({ metric: event.target.value })}
                />
              )}
            </Field>
            {steps.map((step, index) => (
              <fieldset key={index} className={styles.milestone}>
                <legend>{`${t.achievement.steps} ${index + 1}`}</legend>
                <Field
                  label={`${t.achievement.steps} ${index + 1} ${t.achievement.value}`}
                  error={problems?.value[index] ? t.achievement.errors.value : undefined}
                >
                  {(control) => (
                    <Input
                      {...control}
                      type="number"
                      min={1}
                      value={step.value}
                      onChange={(event) =>
                        setStep(index, { value: Math.max(1, Number(event.target.value) || 1) })
                      }
                    />
                  )}
                </Field>
                <RewardListEditor
                  legend={`${t.achievement.steps} ${index + 1}`}
                  rewards={step.rewards}
                  onChange={(rewards: RewardConfig[]) => setStep(index, { rewards })}
                  coupons={couponChoices}
                  badges={badgeChoices}
                  labels={labels}
                />
                {problems?.rewards[index] && (
                  <Alert tone="warning">{t.achievement.errors.rewards}</Alert>
                )}
                <div>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={steps.length <= 1}
                    aria-label={t.achievement.removeStep(index + 1)}
                    onClick={() => config({ milestones: steps.filter((_, i) => i !== index) })}
                  >
                    {labels.remove}
                  </Button>
                </div>
              </fieldset>
            ))}
            {problems?.count && <Alert tone="warning">{t.achievement.errors.count}</Alert>}
            <div>
              <Button
                variant="secondary"
                size="sm"
                disabled={steps.length >= MAX_ACHIEVEMENT_STEPS}
                onClick={() =>
                  config({
                    milestones: [
                      ...steps,
                      {
                        value: (steps[steps.length - 1]?.value ?? 0) + 1,
                        rewards: [blankReward()],
                      },
                    ],
                  })
                }
              >
                {t.achievement.addStep}
              </Button>
            </div>
          </>
        ) : draft.kind === 'attendance' ? (
          <>
            <RewardListEditor
              legend={t.attendance.daily}
              rewards={draft.config.daily ?? []}
              onChange={(daily) => config({ daily })}
              coupons={couponChoices}
              badges={badgeChoices}
              labels={labels}
            />
            {milestones.map((milestone, index) => (
              <fieldset key={index} className={styles.milestone}>
                <legend>{`${t.attendance.milestones} ${index + 1}`}</legend>
                <Field label={`${t.attendance.milestones} ${index + 1} ${t.attendance.days}`}>
                  {(control) => (
                    <Input
                      {...control}
                      type="number"
                      min={1}
                      max={3650}
                      value={milestone.days}
                      onChange={(event) =>
                        setMilestone(index, { days: Math.max(1, Number(event.target.value) || 1) })
                      }
                    />
                  )}
                </Field>
                <Checkbox
                  label={`${t.attendance.milestones} ${index + 1}: ${t.attendance.streak}`}
                  description={milestone.streak ? t.attendance.streak : t.attendance.total}
                  checked={milestone.streak}
                  onChange={(event) => setMilestone(index, { streak: event.target.checked })}
                />
                <RewardListEditor
                  legend={`${t.attendance.milestones} ${index + 1}`}
                  rewards={milestone.rewards}
                  onChange={(rewards: RewardConfig[]) => setMilestone(index, { rewards })}
                  coupons={couponChoices}
                  badges={badgeChoices}
                  labels={labels}
                />
                <div>
                  <Button
                    variant="danger"
                    size="sm"
                    aria-label={t.attendance.removeMilestone(index + 1)}
                    onClick={() => config({ milestones: milestones.filter((_, i) => i !== index) })}
                  >
                    {labels.remove}
                  </Button>
                </div>
              </fieldset>
            ))}
            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  config({ milestones: [...milestones, { days: 7, streak: true, rewards: [] }] })
                }
              >
                {t.attendance.addMilestone}
              </Button>
            </div>
          </>
        ) : (
          <>
            <RewardListEditor
              legend={t.referral.invitee}
              rewards={draft.config.invitee ?? []}
              onChange={(invitee) => config({ invitee })}
              coupons={couponChoices}
              badges={badgeChoices}
              labels={labels}
            />
            <RewardListEditor
              legend={t.referral.inviter}
              rewards={draft.config.inviter ?? []}
              onChange={(inviter) => config({ inviter })}
              coupons={couponChoices}
              badges={badgeChoices}
              labels={labels}
            />
            <Field label={t.referral.qualifyOn}>
              {(control) => (
                <Select
                  {...control}
                  value={draft.config.qualifyOn ?? 'SIGNAL'}
                  onChange={(event) =>
                    config({ qualifyOn: event.target.value as 'CLAIM' | 'SIGNAL' })
                  }
                >
                  <option value="CLAIM">{t.referral.qualifyClaim}</option>
                  <option value="SIGNAL">{t.referral.qualifySignal}</option>
                </Select>
              )}
            </Field>
            <Field label={t.referral.claimWithinDays}>
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min={1}
                  max={365}
                  value={draft.config.claimWithinDays ?? 7}
                  onChange={(event) =>
                    config({ claimWithinDays: Math.max(1, Number(event.target.value) || 1) })
                  }
                />
              )}
            </Field>
            <Field label={t.referral.inviterCap} hint={t.referral.inviterCapHint}>
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min={1}
                  value={draft.config.inviterCap ?? ''}
                  onChange={(event) =>
                    config({
                      inviterCap:
                        event.target.value === ''
                          ? null
                          : Math.max(1, Number(event.target.value) || 1),
                    })
                  }
                />
              )}
            </Field>
          </>
        )}
      </form>
    </Dialog>
  )
}
