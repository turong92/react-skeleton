import { formatInstant } from '@skeleton/time'
import { Alert, Button, Checkbox, ConfirmDialog, Dialog, Spinner, SwitchRow } from '@skeleton/ui'
import { LegalDocumentView, useLegalDocument, type LegalApi } from '@skeleton/legal'
import { useMemo, useState, type ReactNode } from 'react'
import type { PushApi } from '../pushApi'
import type { PushAdvertising } from '../types'
import {
  isAdvertisingAbsent,
  useAdvertising,
  useAgreeAdvertising,
  useWithdrawAdvertising,
} from './hooks'
import {
  resolveAdvertisingLabels,
  type AdvertisingLabels,
  type AdvertisingLabelsInput,
} from './labels'
import { daysLeft, isOn, needsReconfirm, type ConsentKind } from './logic'
import styles from './AdvertisingSettings.module.css'

export type AdvertisingSettingsProps = {
  push: PushApi
  legal: LegalApi
  labels?: AdvertisingLabelsInput
  /** 동의문을 읽을 언어(UI 언어) — 없으면 서버의 기본 언어 */
  locale?: string
  /** 시각 글자(기본 `@skeleton/time` 의 `formatInstant`) */
  formatTime?: (iso: string) => string
  /** 「D-n」 계산의 지금(밀리초) — 기본은 화면이 열린 때. 시험 · 스토리용 */
  now?: number
}

const KINDS: ConsentKind[] = ['consent', 'night']

/**
 * 광고성 푸시 수신 동의 칸(정보통신망법 §50) — `PushSettings` 아래에 둔다.
 * 광고 수신 · 야간(21~08시) 수신은 **각각 따로, 처음엔 꺼짐**이고 동의는 동의문을 읽고 체크(미리 체크 없음)한 뒤에만 기록된다.
 * 야간은 광고 수신에 동의하지 않으면 못 켠다. 서버 읽기가 실패하면 아무것도 켜진 것으로 보이지 않는다.
 * 만료 · 만료 임박이면 띠로 재확인(`source: reconfirm`)을 받고, 끄기는 확인 대화상자 뒤 철회 호출이다.
 * 광고를 못 받는다고 서비스 이용을 막지 않는다. 광고 경로가 없는 백엔드(404)에서는 아무것도 그리지 않는다.
 */
export function AdvertisingSettings({
  push,
  legal,
  labels,
  locale,
  formatTime = (iso) => formatInstant(iso),
  now,
}: AdvertisingSettingsProps) {
  const text = useMemo(() => resolveAdvertisingLabels(labels), [labels])
  const query = useAdvertising(push)
  const agree = useAgreeAdvertising(legal)
  const withdraw = useWithdrawAdvertising(legal)
  const [clock] = useState(() => Date.now())
  const [dialog, setDialog] = useState<ConsentKind | null>(null)
  const [opened, setOpened] = useState(0)
  const [withdrawing, setWithdrawing] = useState<ConsentKind | null>(null)
  const [withdrawnAt, setWithdrawnAt] = useState<string | null>(null)

  if (query.isPending) return <Spinner label={text.loading} />
  if (query.isError && isAdvertisingAbsent(query.error)) return null
  // 읽지 못했으면 예전에 읽은 값이 있어도 쓰지 않는다 — 켜진 것처럼 보이면 안 된다
  if (query.isError || !query.data)
    return (
      <Alert
        tone="danger"
        action={
          <Button
            variant="secondary"
            size="sm"
            loading={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {text.retry}
          </Button>
        }
      >
        {text.loadFailed}
      </Alert>
    )

  const ad = query.data
  const target = (kind: ConsentKind) => (kind === 'consent' ? ad.consent : ad.night)
  const title = (kind: ConsentKind) => (kind === 'consent' ? text.consent.title : text.night.title)
  const open = (kind: ConsentKind) => {
    agree.reset()
    setOpened((n) => n + 1)
    setDialog(kind)
  }

  return (
    <div className={styles.root}>
      <h3 className={styles.heading}>{text.title}</h3>
      <p className={styles.hint}>{text.description(ad.senderName)}</p>

      {KINDS.map((kind) => {
        const c = target(kind)
        // 야간 동의는 광고 동의가 있어야 의미가 있다 — 광고가 꺼져 있으면 재확인 띠도 보이지 않는다
        if (!(kind === 'consent' || isOn(ad, 'consent')) || !needsReconfirm(c)) return null
        const expired = c.state === 'EXPIRED'
        const action = expired ? text.reconfirm.expiredAction : text.reconfirm.dueAction
        return (
          <Alert
            key={kind}
            tone={expired ? 'warning' : 'info'}
            title={
              expired
                ? text.reconfirm.expiredTitle
                : text.reconfirm.dueTitle(daysLeft(c.expiresAt ?? '', now ?? clock))
            }
            action={
              <Button
                size="sm"
                aria-label={text.reconfirm.actionFor(action, title(kind))}
                onClick={() => open(kind)}
              >
                {action}
              </Button>
            }
          >
            {`${title(kind)} · ${expired ? text.reconfirm.expiredDescription : text.reconfirm.dueDescription}`}
          </Alert>
        )
      })}

      {KINDS.map((kind) => (
        <ConsentRow
          key={kind}
          kind={kind}
          ad={ad}
          text={text}
          formatTime={formatTime}
          busy={query.isFetching}
          onAgree={() => open(kind)}
          onWithdraw={() => setWithdrawing(kind)}
        />
      ))}

      {withdrawnAt && (
        <p role="status" className={styles.hint}>
          {text.withdraw.done(formatTime(withdrawnAt))}
        </p>
      )}
      {withdraw.isError && <Alert tone="danger">{text.withdraw.failed}</Alert>}

      <AgreeDialog
        key={opened}
        kind={dialog}
        ad={ad}
        legal={legal}
        locale={locale}
        text={text}
        busy={agree.isPending}
        failed={agree.isError}
        onClose={() => setDialog(null)}
        onConfirm={async (kind, doc) => {
          await agree.mutateAsync({ ad, kind, doc })
          setWithdrawnAt(null)
          setDialog(null)
        }}
      />

      <ConfirmDialog
        open={withdrawing !== null}
        onClose={() => setWithdrawing(null)}
        title={text.withdraw.title}
        description={`${withdrawing ? title(withdrawing) : ''} — ${text.withdraw.description}`}
        confirmLabel={text.withdraw.confirm}
        cancelLabel={text.withdraw.cancel}
        closeLabel={text.dialog.close}
        loadingLabel={text.loading}
        busy={withdraw.isPending}
        onConfirm={() => {
          const kind = withdrawing
          if (!kind) return
          void withdraw
            .mutateAsync({ ad, kind })
            .then(() => setWithdrawnAt(new Date().toISOString()))
            .catch(() => undefined)
            .finally(() => setWithdrawing(null))
        }}
      />
    </div>
  )
}

type RowProps = {
  kind: ConsentKind
  ad: PushAdvertising
  text: AdvertisingLabels
  formatTime: (iso: string) => string
  busy: boolean
  onAgree: () => void
  onWithdraw: () => void
}

/** 켜짐이면 끄는 스위치(끄기는 확인을 거친다), 꺼짐이면 「동의하기」 단추 — 스위치로 바로 동의가 기록되는 길은 없다 */
function ConsentRow({ kind, ad, text, formatTime, busy, onAgree, onWithdraw }: RowProps) {
  const c = kind === 'consent' ? ad.consent : ad.night
  const title = kind === 'consent' ? text.consent.title : text.night.title
  const on = isOn(ad, kind)
  const locked = kind === 'night' && !isOn(ad, 'consent')
  const base =
    kind === 'consent'
      ? text.consent.description
      : text.night.description(ad.nightWindow.start, ad.nightWindow.end, ad.nightWindow.zone)

  if (on)
    return (
      <SwitchRow
        title={title}
        description={
          c.agreedAt && c.expiresAt
            ? `${base} ${text.consent.agreedUntil(formatTime(c.agreedAt), formatTime(c.expiresAt))}`
            : base
        }
        checked
        busy={busy}
        // 켜는 쪽은 여기 없다 — 동의는 동의문을 읽는 대화상자에서만
        onChange={(next) => {
          if (!next) onWithdraw()
        }}
      />
    )

  const extra: ReactNode = locked
    ? text.night.locked
    : c.state === 'EXPIRED' || c.state === 'WITHDRAWN' || c.state === 'OUTDATED'
      ? text.consent.stopped
      : null
  return (
    <div className={styles.row}>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.hint}>{base}</span>
        {extra && <span className={styles.hint}>{extra}</span>}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={locked}
        aria-label={text.consent.agreeFor(title)}
        onClick={onAgree}
      >
        {text.consent.agree}
      </Button>
    </div>
  )
}

type AgreeDialogProps = {
  kind: ConsentKind | null
  ad: PushAdvertising
  legal: LegalApi
  locale?: string
  text: AdvertisingLabels
  busy: boolean
  failed: boolean
  onClose: () => void
  onConfirm: (kind: ConsentKind, doc: { version: string; locale: string }) => Promise<void>
}

/** 동의문을 보여 주고, 처음엔 꺼진 체크를 사용자가 켠 뒤에만 「동의하고 받기」가 눌린다. 읽은 판으로 기록한다 */
function AgreeDialog({
  kind,
  ad,
  legal,
  locale,
  text,
  busy,
  failed,
  onClose,
  onConfirm,
}: AgreeDialogProps) {
  const [checked, setChecked] = useState(false)
  const type = kind ? (kind === 'consent' ? ad.consent.type : ad.night.type) : ''
  const doc = useLegalDocument(legal, type, { locale, enabled: kind !== null })
  const title = kind === 'night' ? text.night.title : text.consent.title
  return (
    <Dialog
      open={kind !== null}
      onClose={onClose}
      title={title}
      closeLabel={text.dialog.close}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {text.dialog.cancel}
          </Button>
          <Button
            disabled={!checked || !doc.data}
            loading={busy}
            onClick={() => {
              if (kind && doc.data)
                void onConfirm(kind, { version: doc.data.version, locale: doc.data.locale }).catch(
                  () => undefined,
                )
            }}
          >
            {text.dialog.confirm}
          </Button>
        </>
      }
    >
      <div className={styles.document}>
        {doc.isPending && kind && <Spinner label={text.dialog.loadingDocument} />}
        {doc.isError && (
          <Alert
            tone="danger"
            action={
              <Button variant="secondary" size="sm" onClick={() => void doc.refetch()}>
                {text.retry}
              </Button>
            }
          >
            {text.dialog.documentFailed}
          </Alert>
        )}
        {doc.data && <LegalDocumentView document={doc.data} showTitle={false} headingOffset={2} />}
        <Checkbox
          label={text.dialog.check}
          checked={checked}
          disabled={!doc.data}
          onChange={(event) => setChecked(event.target.checked)}
        />
        {failed && <Alert tone="danger">{text.dialog.agreeFailed}</Alert>}
      </div>
    </Dialog>
  )
}
