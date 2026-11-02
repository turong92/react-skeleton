import { formatInstant } from '@skeleton/time'
import {
  Alert,
  Button,
  Checkbox,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
} from '@skeleton/ui'
import { useState } from 'react'
import type { BroadcastAdminApi } from './adminApi'
import { broadcastErrorMessage, isToolOff, mergeBroadcastLabels } from './adminErrors'
import { ConfirmDialog } from './ConfirmDialog'
import { fromLocalInput, isAppPath, isNightHour, toLocalInput } from './format'
import { useAudienceCount, useBroadcast, useBroadcastMutations, useBroadcastOptions } from './hooks'
import type { BroadcastAdminLabels } from './labels'
import { allowAll, BROADCAST_PERMISSIONS, type CanFn } from './permissions'
import type { Broadcast, BroadcastInput, BroadcastOptions } from './types'
import styles from './admin.module.css'

export const TITLE_MAX = 100
export const BODY_MAX = 2000

export type Choice = { value: string; label: string }

export type AdminBroadcastEditorProps = {
  api: Pick<
    BroadcastAdminApi,
    | 'options'
    | 'audienceCount'
    | 'get'
    | 'create'
    | 'update'
    | 'remove'
    | 'sendTest'
    | 'send'
    | 'unschedule'
    | 'cancel'
    | 'resume'
  >
  /** 고칠 임시 저장의 id - 없으면 새 공지 */
  id?: string
  /** 대상 「역할」 에서 고를 역할(예: `GET /admin/roles`) - 없으면 이름을 직접 적는다 */
  roleChoices?: readonly Choice[]
  /** 대상 「워크스페이스」 에서 고를 워크스페이스 - 없으면 id 를 직접 적는다 */
  workspaceChoices?: readonly Choice[]
  /** 종류 코드 → 보이는 이름(앱이 정한 종류 목록). 없으면 코드 그대로 */
  typeLabels?: Record<string, string>
  /** 임시 저장했다 */
  onSaved?: (id: string) => void
  /** 보내기(또는 예약)가 받아들여졌다 - 보통 상세로 간다 */
  onSent: (id: string) => void
  /** 「취소」 - 보통 목록으로 돌아간다 */
  onCancel: () => void
  /** 권한 질문 - `notification-broadcast.send` 가 없으면 쓰는 화면이 없다(서버가 다시 판정한다). 기본 모두 허용 */
  can?: CanFn
  labels?: Partial<BroadcastAdminLabels>
  locale?: string
  formatTime?: (iso: string) => string
}

type Draft = {
  type: string
  title: string
  body: string
  link: string
  /** 알림함 말고 고른 채널 */
  channels: string[]
  audienceKind: string
  audienceParam: string
  scheduled: boolean
  /** `datetime-local` 값(브라우저 시간대) */
  scheduledAt: string
}

const initialDraft = (options: BroadcastOptions, from?: Broadcast): Draft =>
  from
    ? {
        type: from.type,
        title: from.title,
        body: from.body ?? '',
        link: from.link ?? '',
        channels: from.channels,
        audienceKind: from.audience.kind,
        audienceParam: from.audience.param ?? '',
        scheduled: from.scheduledAt !== null,
        scheduledAt: toLocalInput(from.scheduledAt),
      }
    : {
        type: options.types[0]?.type ?? '',
        title: '',
        body: '',
        link: '',
        channels: [],
        audienceKind: options.audiences[0]?.kind ?? '',
        audienceParam: '',
        scheduled: false,
        scheduledAt: '',
      }

/** 공지 쓰기 - 종류 · 제목 · 본문 · 링크 · 대상(+ 대상 수) · 채널 · 즉시/예약 · 나에게 테스트 · 보내기(확인 창을 거친다). 임시 저장한 것을 고치기도 한다 */
export function AdminBroadcastEditor(props: AdminBroadcastEditorProps) {
  const labels = mergeBroadcastLabels(props.labels)
  const t = labels.editor
  const options = useBroadcastOptions(props.api)
  const existing = useBroadcast(props.api, props.id)

  if (!(props.can ?? allowAll)(BROADCAST_PERMISSIONS.send))
    return <Alert tone="warning">{t.noPermission}</Alert>
  const failed = options.error ?? existing.error
  if (failed)
    return (
      <Alert tone="danger">
        {isToolOff(failed) && options.error
          ? labels.errors.notEnabled
          : broadcastErrorMessage(failed, labels)}
      </Alert>
    )
  if (!options.data || (props.id !== undefined && !existing.data))
    return <Skeleton label={labels.loading} />
  if (existing.data && existing.data.status !== 'DRAFT')
    return <Alert tone="warning">{t.notEditable}</Alert>
  return <EditorForm {...props} labels={labels} options={options.data} draftOf={existing.data} />
}

function EditorForm({
  api,
  id,
  roleChoices,
  workspaceChoices,
  typeLabels = {},
  onSaved,
  onSent,
  onCancel,
  labels,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
  options,
  draftOf,
}: AdminBroadcastEditorProps & {
  labels: BroadcastAdminLabels
  options: BroadcastOptions
  draftOf?: Broadcast
}) {
  const t = labels.editor
  const mutations = useBroadcastMutations(api)
  const [draft, setDraft] = useState(() => initialDraft(options, draftOf))
  const [savedId, setSavedId] = useState<string | undefined>(id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [showProblems, setShowProblems] = useState(false)
  const patch = (next: Partial<Draft>) => {
    setNotice(null)
    setDraft((now) => ({ ...now, ...next }))
  }

  const typeInfo = options.types.find((x) => x.type === draft.type)
  const audienceInfo = options.audiences.find((a) => a.kind === draft.audienceKind)
  const paramKind = audienceInfo?.param ?? 'NONE'
  const advertising = typeInfo?.advertising ?? false
  /** 푸시 불가 종류면 푸시는 늘 빠진다(칸도 잠긴다) */
  const pushLocked = (channel: string) => channel === 'push' && typeInfo?.push === false
  const channels = draft.channels.filter((c) => !pushLocked(c))

  const audience = {
    kind: draft.audienceKind,
    param: paramKind === 'NONE' ? null : draft.audienceParam.trim(),
  }
  const audienceReady = audience.kind !== '' && (paramKind === 'NONE' || !!audience.param)
  const count = useAudienceCount(api, audience, audienceReady)
  const scheduledIso = draft.scheduled ? fromLocalInput(draft.scheduledAt) : null

  const problems = [
    !audienceReady && t.problems.audienceParam,
    draft.link.trim() !== '' && !isAppPath(draft.link.trim()) && t.problems.link,
    draft.scheduled && !scheduledIso && t.problems.scheduledAt,
  ].filter((p): p is string => !!p)
  const invalid = draft.title.trim() === '' || draft.type === '' || problems.length > 0

  const input = (): BroadcastInput => ({
    type: draft.type,
    title: draft.title.trim(),
    body: draft.body.trim() === '' ? null : draft.body,
    link: draft.link.trim() === '' ? null : draft.link.trim(),
    channels,
    audience,
  })

  /** 임시 저장(처음이면 만들고, 이미 있으면 고친다) - 만든 id 는 기억해 두 번째 누름이 또 만들지 않게 한다 */
  const save = async (): Promise<string> => {
    if (savedId) {
      await mutations.update.mutateAsync({ id: savedId, input: input() })
      return savedId
    }
    const created = await mutations.create.mutateAsync(input())
    setSavedId(created.id)
    return created.id
  }

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await work()
    } catch (failure) {
      setError(broadcastErrorMessage(failure, labels))
    } finally {
      setBusy(false)
    }
  }

  const guarded = (action: () => void) => () => {
    if (invalid) return setShowProblems(true)
    setShowProblems(false)
    action()
  }

  const nightWarning = advertising && scheduledIso !== null && isNightHour(new Date(scheduledIso))
  const channelName = (key: string) => labels.channelNames[key] ?? key
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <div className={styles.page}>
      <PageHeader title={id ? t.editTitle : t.createTitle} />
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          guarded(() => setConfirming(true))()
        }}
      >
        {error && <Alert tone="danger">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
        {showProblems && problems.length > 0 && (
          <Alert tone="warning" title={t.problems.title}>
            {problems.join(' ')}
          </Alert>
        )}
        <Field label={t.type} required>
          {(control) => (
            <Select
              {...control}
              value={draft.type}
              onChange={(event) => patch({ type: event.target.value })}
            >
              {options.types.map((x) => (
                <option key={x.type} value={x.type}>
                  {typeLabels[x.type] ?? x.type}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {advertising && <Alert tone="info">{t.advertisingNotice}</Alert>}
        <Field label={t.title} required>
          {(control) => (
            <Input
              {...control}
              value={draft.title}
              maxLength={TITLE_MAX}
              onChange={(event) => patch({ title: event.target.value })}
            />
          )}
        </Field>
        <Field label={t.body} hint={t.bodyCount(draft.body.length, BODY_MAX)}>
          {(control) => (
            <Textarea
              {...control}
              value={draft.body}
              maxLength={BODY_MAX}
              rows={5}
              onChange={(event) => patch({ body: event.target.value })}
            />
          )}
        </Field>
        <Field label={t.link} hint={t.linkHint}>
          {(control) => (
            <Input
              {...control}
              value={draft.link}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => patch({ link: event.target.value })}
            />
          )}
        </Field>
        <fieldset className={styles.group}>
          <legend>{t.audience}</legend>
          <Field label={t.audienceKind}>
            {(control) => (
              <Select
                {...control}
                value={draft.audienceKind}
                onChange={(event) => patch({ audienceKind: event.target.value, audienceParam: '' })}
              >
                {options.audiences.map((a) => (
                  <option key={a.kind} value={a.kind}>
                    {labels.audienceKinds[a.kind] ?? a.kind}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {paramKind !== 'NONE' && (
            <ParamField
              label={t.audienceParam[paramKind]}
              value={draft.audienceParam}
              choices={
                paramKind === 'ROLE'
                  ? roleChoices
                  : paramKind === 'WORKSPACE'
                    ? workspaceChoices
                    : undefined
              }
              onChange={(audienceParam) => patch({ audienceParam })}
            />
          )}
          <p className={styles.count} role="status">
            {!audienceReady
              ? ''
              : count.isPending
                ? t.audienceCountLoading
                : count.isError
                  ? t.audienceCountFailed
                  : t.audienceCount(count.data.count)}
          </p>
        </fieldset>
        <fieldset className={styles.group}>
          <legend>{t.channels}</legend>
          <Checkbox label={t.inboxAlways} checked disabled readOnly />
          {options.channels.map((channel) => (
            <Checkbox
              key={channel}
              label={channelName(channel)}
              description={pushLocked(channel) ? t.pushLocked : undefined}
              checked={channels.includes(channel)}
              disabled={pushLocked(channel)}
              onChange={(event) =>
                patch({
                  channels: event.target.checked
                    ? [...channels, channel]
                    : channels.filter((c) => c !== channel),
                })
              }
            />
          ))}
        </fieldset>
        <Field label={t.when}>
          {(control) => (
            <Select
              {...control}
              value={draft.scheduled ? 'schedule' : 'now'}
              onChange={(event) => patch({ scheduled: event.target.value === 'schedule' })}
            >
              <option value="now">{t.now}</option>
              <option value="schedule">{t.schedule}</option>
            </Select>
          )}
        </Field>
        {draft.scheduled && (
          <Field label={t.scheduledAt} hint={t.scheduledAtHint(timeZone)} required>
            {(control) => (
              <Input
                {...control}
                type="datetime-local"
                value={draft.scheduledAt}
                onChange={(event) => patch({ scheduledAt: event.target.value })}
              />
            )}
          </Field>
        )}
        {nightWarning && <Alert tone="warning">{t.nightWarning}</Alert>}
        {advertising && <Alert tone="info">{t.testAdvertising}</Alert>}
        <div className={styles.row}>
          <Button type="submit" disabled={busy}>
            {draft.scheduled ? t.sendScheduled : t.send}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={guarded(
              () =>
                void run(async () => {
                  const saved = await save()
                  await mutations.sendTest.mutateAsync(saved)
                  setNotice(t.testSent)
                }),
            )}
          >
            {t.test}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={guarded(
              () =>
                void run(async () => {
                  const saved = await save()
                  setNotice(t.saved)
                  onSaved?.(saved)
                }),
            )}
          >
            {t.saveDraft}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            {labels.cancel}
          </Button>
        </div>
      </form>
      {confirming && (
        <ConfirmDialog
          title={draft.scheduled ? labels.confirm.scheduleTitle : labels.confirm.sendTitle}
          confirmLabel={
            count.data
              ? (draft.scheduled ? labels.confirm.scheduleConfirm : labels.confirm.sendConfirm)(
                  count.data.count,
                )
              : t.audienceCountLoading
          }
          cancelLabel={labels.cancel}
          closeLabel={labels.close}
          loadingLabel={labels.loading}
          confirmDisabled={!count.data}
          busy={busy}
          error={error}
          onClose={() => setConfirming(false)}
          onConfirm={() =>
            void run(async () => {
              const saved = await save()
              await mutations.send.mutateAsync({ id: saved, scheduledAt: scheduledIso })
              setConfirming(false)
              onSent(saved)
            })
          }
        >
          <dl className={styles.facts}>
            <dt>{labels.confirm.audience}</dt>
            <dd>
              {[labels.audienceKinds[audience.kind] ?? audience.kind, audience.param]
                .filter(Boolean)
                .join(' · ')}
              {' — '}
              {count.data ? t.audienceCount(count.data.count) : t.audienceCountLoading}
            </dd>
            <dt>{labels.confirm.channels}</dt>
            <dd>{[t.inboxAlways, ...channels.map(channelName)].join(', ')}</dd>
            <dt>{labels.confirm.when}</dt>
            <dd>{scheduledIso ? formatTime(scheduledIso) : t.now}</dd>
          </dl>
        </ConfirmDialog>
      )}
    </div>
  )
}

function ParamField({
  label,
  value,
  choices,
  onChange,
}: {
  label: string
  value: string
  choices?: readonly Choice[]
  onChange: (value: string) => void
}) {
  return (
    <Field label={label} required>
      {(control) =>
        choices ? (
          <Select {...control} value={value} onChange={(event) => onChange(event.target.value)}>
            <option value="" />
            {choices.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            {...control}
            value={value}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => onChange(event.target.value)}
          />
        )
      }
    </Field>
  )
}
