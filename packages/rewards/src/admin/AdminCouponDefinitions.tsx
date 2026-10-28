import {
  Alert,
  Badge,
  Button,
  Checkbox,
  CopyButton,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Table,
  Textarea,
} from '@skeleton/ui'
import { useId, useState, type FormEvent } from 'react'
import { defaultRewardsLabels, type RewardsLabels } from '../labels'
import { stageSummary } from '../coupon/stageSummary'
import type { CouponStage } from '../types'
import type { RewardsAdminApi } from './adminApi'
import { accountLabelOf, type AccountChoice } from './accountLabel'
import { AccountSearch } from './AccountSearch'
import { adminErrorMessage, isToolOff, mergeAdminLabels } from './adminErrors'
import { fromLocalInput, startsBefore } from './dateInput'
import { useAccountCoupons, useAdminCouponDefinitions, useCouponDefinitionMutations } from './hooks'
import type { RewardsAdminLabels } from './labels'
import { allowAll, REWARDS_PERMISSIONS, type CanFn } from './permissions'
import type { RenderRowLink } from './rowAction'
import { rowActionClass } from './rowAction'
import { StageEditor } from './StageEditor'
import { freeVoucher } from './stageEdits'
import type {
  CouponDefinition,
  CouponDefinitionInput,
  CouponDefinitionStatus,
  IssueResult,
} from './types'
import styles from './AdminCouponDefinitions.module.css'

export type AdminCouponDefinitionsProps = {
  api: Pick<
    RewardsAdminApi,
    | 'listCouponDefinitions'
    | 'createCouponDefinition'
    | 'setCouponDefinitionStatus'
    | 'issueCoupons'
    | 'createCouponCode'
    | 'listAccountCoupons'
    | 'revokeCoupon'
  >
  can?: CanFn
  labels?: Partial<RewardsAdminLabels>
  /** 혜택 한 줄(`stageSummary`)의 문구 - 사용자 화면과 같은 사전 */
  userLabels?: RewardsLabels
  locale?: string
  /**
   * 계정 검색 - 앱이 계정 API 를 이 꼴로 옮겨 준다(이메일 · 로그인 아이디). 주지 않으면 「계정의 쿠폰」 칸이 없다.
   * 계정 id 를 직접 적는 칸은 없다
   */
  searchAccounts?: (query: string) => Promise<AccountChoice[]>
  /** 줄 끝 「자세히」 를 정의 한 건 화면으로 잇는 라우터 링크. 없으면 단추가 없다 */
  renderDetailLink?: RenderRowLink<CouponDefinition>
}

const STATUSES: readonly CouponDefinitionStatus[] = ['ACTIVE', 'PAUSED', 'ARCHIVED']
const list = (text: string) =>
  text
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean)
const numberOrNull = (text: string) => (text === '' ? null : Math.max(0, Math.trunc(Number(text))))

type Draft = {
  name: string
  stages: CouponStage[]
  currency: string
  minAmount: string
  purposes: string
  itemTypes: string
  planCodes: string
  firstPurchaseOnly: boolean
  validDays: string
  validUntil: string
  validFrom: string
  issueStartsAt: string
  issueEndsAt: string
  issueLimit: string
  perAccountLimit: string
}

const emptyDraft = (): Draft => ({
  name: '',
  stages: freeVoucher(),
  currency: '',
  minAmount: '',
  purposes: '',
  itemTypes: '',
  planCodes: '',
  firstPurchaseOnly: false,
  validDays: '',
  validUntil: '',
  validFrom: '',
  issueStartsAt: '',
  issueEndsAt: '',
  issueLimit: '',
  perAccountLimit: '1',
})

const inputOf = (draft: Draft): CouponDefinitionInput => ({
  name: draft.name.trim(),
  stages: draft.stages,
  currency: draft.currency.trim().toUpperCase() || null,
  minAmount: numberOrNull(draft.minAmount),
  scope: {
    purposes: list(draft.purposes),
    itemTypes: list(draft.itemTypes),
    planCodes: list(draft.planCodes),
  },
  firstPurchaseOnly: draft.firstPurchaseOnly,
  validDays: numberOrNull(draft.validDays),
  validUntil: fromLocalInput(draft.validUntil),
  validFrom: fromLocalInput(draft.validFrom),
  issueStartsAt: fromLocalInput(draft.issueStartsAt),
  issueEndsAt: fromLocalInput(draft.issueEndsAt),
  issueLimit: numberOrNull(draft.issueLimit),
  perAccountLimit: Math.max(1, Number(draft.perAccountLimit) || 1),
})

/**
 * 쿠폰 운영 - 정의 목록(혜택 한 줄 · 상태 · 발급 수), 만들기(단계 편집기), 상태 바꾸기, 계정에 주기, 공용 코드 만들기,
 * 그리고 한 계정의 쿠폰 보기 · 회수. 백엔드 `skeleton.coupon.admin.enabled=true` + `coupon.manage`
 */
export function AdminCouponDefinitions({
  api,
  can = allowAll,
  labels: given,
  userLabels = defaultRewardsLabels,
  locale,
  searchAccounts,
  renderDetailLink,
}: AdminCouponDefinitionsProps) {
  const labels = mergeAdminLabels(given)
  const t = labels.coupons
  const allowed = can(REWARDS_PERMISSIONS.coupon)
  const query = useAdminCouponDefinitions(api)
  const mutations = useCouponDefinitionMutations(api)
  const [creating, setCreating] = useState(false)
  const [issuing, setIssuing] = useState<CouponDefinition | null>(null)
  const [codeFor, setCodeFor] = useState<CouponDefinition | null>(null)
  const [account, setAccount] = useState<AccountChoice | null>(null)
  const accountCoupons = useAccountCoupons(api, account?.id ?? null)

  const makeCode = (definition: CouponDefinition) => {
    setCodeFor(definition)
    mutations.code.mutate(definition.id)
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title={t.title}
        actions={
          allowed && (
            <Button onClick={() => setCreating(true)} disabled={!query.data}>
              {t.create}
            </Button>
          )
        }
      />
      {(mutations.setStatus.isError || mutations.revoke.isError) && (
        <Alert tone="danger">
          {adminErrorMessage(mutations.setStatus.error ?? mutations.revoke.error, labels)}
        </Alert>
      )}
      {query.isPending ? (
        <Skeleton label={labels.loading} />
      ) : query.isError ? (
        <Alert
          tone="danger"
          action={
            isToolOff(query.error) ? undefined : (
              <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
                {labels.retry}
              </Button>
            )
          }
        >
          {isToolOff(query.error) ? labels.errors.notEnabled : labels.loadFailed}
        </Alert>
      ) : (
        <Table
          caption={t.caption}
          rows={query.data}
          rowKey={(d) => d.id}
          empty={<EmptyState title={t.empty} headingLevel={2} />}
          columns={[
            { key: 'name', header: t.columns.name, rowHeader: true, render: (d) => d.name },
            {
              key: 'benefit',
              header: t.columns.benefit,
              render: (d) =>
                stageSummary(d.stages, userLabels.coupon, { currency: d.currency, locale }),
            },
            {
              key: 'status',
              header: t.columns.status,
              render: (d) =>
                allowed ? (
                  <Select
                    aria-label={t.setStatus(d.name, t.status[d.status])}
                    value={d.status}
                    disabled={mutations.setStatus.isPending}
                    onChange={(event) =>
                      mutations.setStatus.mutate({
                        id: d.id,
                        status: event.target.value as CouponDefinitionStatus,
                      })
                    }
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {t.status[status]}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Badge>{t.status[d.status]}</Badge>
                ),
            },
            {
              key: 'issued',
              header: t.columns.issued,
              align: 'end',
              render: (d) =>
                d.issueLimit === null ? `${d.issuedCount}` : `${d.issuedCount} / ${d.issueLimit}`,
            },
            {
              key: 'actions',
              header: t.columns.actions,
              render: (d) => (
                <span className={styles.actions}>
                  {renderDetailLink?.(
                    d,
                    t.details,
                    labels.couponDetail.open(d.name),
                    rowActionClass,
                  )}
                  {allowed && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={`${t.issue}: ${d.name}`}
                        disabled={d.status !== 'ACTIVE'}
                        onClick={() => setIssuing(d)}
                      >
                        {t.issue}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={`${t.makeCode}: ${d.name}`}
                        disabled={d.status !== 'ACTIVE'}
                        onClick={() => makeCode(d)}
                      >
                        {t.makeCode}
                      </Button>
                    </>
                  )}
                </span>
              ),
            },
          ]}
        />
      )}

      {searchAccounts && (
        <section className={styles.account} aria-labelledby="account-coupons">
          <h2 id="account-coupons">{t.accountCoupons}</h2>
          {account === null ? (
            <AccountSearch search={searchAccounts} onPick={setAccount} labels={labels} />
          ) : (
            <p className={styles.picked}>
              <span>
                {labels.accountSearch.picked}: <strong>{accountLabelOf(account)}</strong>
              </span>
              <Button variant="secondary" size="sm" onClick={() => setAccount(null)}>
                {labels.accountSearch.change}
              </Button>
            </p>
          )}
          {account !== null &&
            (accountCoupons.isPending ? (
              <Skeleton label={labels.loading} />
            ) : accountCoupons.isError ? (
              <Alert tone="danger">{adminErrorMessage(accountCoupons.error, labels)}</Alert>
            ) : (
              <Table
                caption={t.couponCaption}
                rows={accountCoupons.data}
                rowKey={(c) => c.id}
                empty={<EmptyState title={t.noAccountCoupons} headingLevel={3} />}
                columns={[
                  { key: 'name', header: t.columns.name, rowHeader: true, render: (c) => c.name },
                  {
                    key: 'status',
                    header: t.columns.status,
                    render: (c) => userLabels.coupon.status[c.status],
                  },
                  {
                    key: 'actions',
                    header: t.columns.actions,
                    render: (c) =>
                      allowed &&
                      c.status === 'AVAILABLE' && (
                        <Button
                          variant="danger"
                          size="sm"
                          aria-label={t.revoke(c.name)}
                          loading={mutations.revoke.isPending}
                          loadingLabel={labels.loading}
                          onClick={() => mutations.revoke.mutate(c.id)}
                        >
                          {t.revokeButton}
                        </Button>
                      ),
                  },
                ]}
              />
            ))}
        </section>
      )}

      {creating && (
        <DefinitionDialog
          labels={labels}
          busy={mutations.create.isPending}
          error={
            mutations.create.isError ? adminErrorMessage(mutations.create.error, labels) : null
          }
          onClose={() => {
            mutations.create.reset()
            setCreating(false)
          }}
          onSubmit={(draft) =>
            mutations.create.mutate(inputOf(draft), { onSuccess: () => setCreating(false) })
          }
        />
      )}
      {issuing && (
        <IssueDialog
          definition={issuing}
          labels={labels}
          busy={mutations.issue.isPending}
          result={mutations.issue.data ?? null}
          error={mutations.issue.isError ? adminErrorMessage(mutations.issue.error, labels) : null}
          onClose={() => {
            mutations.issue.reset()
            setIssuing(null)
          }}
          onSubmit={(accountIds) => mutations.issue.mutate({ id: issuing.id, accountIds })}
        />
      )}
      {codeFor && (
        <Dialog
          open
          onClose={() => {
            mutations.code.reset()
            setCodeFor(null)
          }}
          title={t.codeTitle(codeFor.name)}
          closeLabel={labels.close}
        >
          {mutations.code.isError ? (
            <Alert tone="danger">{adminErrorMessage(mutations.code.error, labels)}</Alert>
          ) : mutations.code.data ? (
            <div className={styles.code}>
              <p>{t.codeBody}</p>
              <strong className={styles.codeText}>{mutations.code.data.code}</strong>
              <CopyButton value={mutations.code.data.code} />
            </div>
          ) : (
            <Skeleton label={labels.loading} />
          )}
        </Dialog>
      )}
    </div>
  )
}

function DefinitionDialog({
  labels,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  labels: RewardsAdminLabels
  busy: boolean
  error: string | null
  onClose: () => void
  onSubmit: (draft: Draft) => void
}) {
  const t = labels.coupons
  const formId = useId()
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  // 서버도 같은 순서를 검사한다(400) - 화면이 먼저 이유를 말한다
  const issueOrdered = startsBefore(
    fromLocalInput(draft.issueStartsAt),
    fromLocalInput(draft.issueEndsAt),
  )
  const useOrdered = startsBefore(fromLocalInput(draft.validFrom), fromLocalInput(draft.validUntil))
  const patch = (next: Partial<Draft>) => setDraft((now) => ({ ...now, ...next }))
  const text = (key: keyof Draft, label: string, hint?: string, type = 'text') => (
    <Field label={label} hint={hint}>
      {(control) => (
        <Input
          {...control}
          type={type}
          value={draft[key] as string}
          onChange={(event) => patch({ [key]: event.target.value } as Partial<Draft>)}
        />
      )}
    </Field>
  )
  return (
    <Dialog
      open
      onClose={onClose}
      title={t.createTitle}
      closeLabel={labels.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {labels.cancel}
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={busy}
            loadingLabel={labels.loading}
            disabled={
              draft.stages.length === 0 || draft.name.trim() === '' || !issueOrdered || !useOrdered
            }
          >
            {labels.save}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className={styles.form}
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          onSubmit(draft)
        }}
      >
        {error && <Alert tone="danger">{error}</Alert>}
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
        <StageEditor
          stages={draft.stages}
          onChange={(stages) => patch({ stages })}
          labels={labels}
        />
        {text('currency', t.currency, t.currencyHint)}
        {text('minAmount', t.minAmount, undefined, 'number')}
        <fieldset className={styles.scope}>
          <legend>{t.scope}</legend>
          <p className={styles.muted}>{t.scopeHint}</p>
          {text('purposes', t.scopePurposes)}
          {text('itemTypes', t.scopeItemTypes)}
          {text('planCodes', t.scopePlanCodes)}
        </fieldset>
        <Checkbox
          label={t.firstPurchaseOnly}
          checked={draft.firstPurchaseOnly}
          onChange={(event) => patch({ firstPurchaseOnly: event.target.checked })}
        />
        {text('validDays', t.validDays, undefined, 'number')}
        {text('validFrom', t.validFrom, t.validFromHint, 'datetime-local')}
        {text('validUntil', t.validUntil, undefined, 'datetime-local')}
        {!useOrdered && <Alert tone="warning">{t.usePeriodOrder}</Alert>}
        <fieldset className={styles.scope}>
          <legend>{t.issuePeriodLegend}</legend>
          <p className={styles.muted}>{t.issuePeriodHint}</p>
          {text('issueStartsAt', t.issueStartsAt, undefined, 'datetime-local')}
          {text('issueEndsAt', t.issueEndsAt, undefined, 'datetime-local')}
          {!issueOrdered && <Alert tone="warning">{t.issuePeriodOrder}</Alert>}
        </fieldset>
        {text('issueLimit', t.issueLimit, t.noLimit, 'number')}
        {text('perAccountLimit', t.perAccountLimit, undefined, 'number')}
      </form>
    </Dialog>
  )
}

function IssueDialog({
  definition,
  labels,
  busy,
  result,
  error,
  onClose,
  onSubmit,
}: {
  definition: CouponDefinition
  labels: RewardsAdminLabels
  busy: boolean
  result: IssueResult | null
  error: string | null
  onClose: () => void
  onSubmit: (accountIds: string[]) => void
}) {
  const t = labels.coupons
  const formId = useId()
  const [text, setText] = useState('')
  return (
    <Dialog
      open
      onClose={onClose}
      title={t.issueTitle(definition.name)}
      closeLabel={labels.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {labels.cancel}
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={busy}
            loadingLabel={labels.loading}
            disabled={list(text).length === 0}
          >
            {t.issue}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className={styles.form}
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          onSubmit(list(text))
        }}
      >
        {error && <Alert tone="danger">{error}</Alert>}
        {result && (
          <Alert tone={result.issued.length > 0 ? 'success' : 'warning'}>
            {t.issuedResult(result.issued.length, result.skipped.length)}
          </Alert>
        )}
        <Field label={t.issueAccounts} hint={t.issueHint}>
          {(control) => (
            <Textarea {...control} value={text} onChange={(event) => setText(event.target.value)} />
          )}
        </Field>
      </form>
    </Dialog>
  )
}
