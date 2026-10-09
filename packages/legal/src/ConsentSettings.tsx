import {
  Alert,
  Badge,
  Button,
  Dialog,
  Pagination,
  SectionCard,
  SettingsRow,
  Skeleton,
  Switch,
  Table,
  type BadgeProps,
  type MarkdownFacts,
} from '@skeleton/ui'
import { ApiRequestError } from '@skeleton/api-client'
import { useState } from 'react'
import { pickDocuments } from './consentLogic'
import { DocumentDialog } from './DocumentDialog'
import { formatWhen } from './format'
import { useAgree, useConsentHistory, useLegalDocuments, useMyConsents, useWithdraw } from './hooks'
import { mergeLegalLabels, type LegalLabels } from './labels'
import type { LegalApi } from './legalApi'
import styles from './ConsentSettings.module.css'
import type { ConsentState, MyConsentItem } from './types'

export type ConsentSettingsProps = {
  api: LegalApi
  /** 읽을 언어(UI 언어) · 대체 언어 */
  locale: string
  fallbackLocale?: string
  facts?: MarkdownFacts
  formatLocale?: string
  zone?: string
  /** 절 id(목차 앵커) — 기본 `consents` */
  id?: string
  /** 줄만 그린다(`@skeleton/auth` 의 `AccountSettings` 의 `preferenceRows` 로 「환경」 카드 안에) - 「보기」가 연 대화상자에 목록 · 이력이 든다. 아니면 제목 있는 절 한 장 */
  row?: boolean
  labels?: Partial<LegalLabels>
}

const TONE: Record<ConsentState, NonNullable<BadgeProps['tone']>> = {
  CURRENT: 'success',
  GRACE: 'info',
  OUTDATED: 'warning',
  MISSING: 'warning',
  WITHDRAWN: 'neutral',
}

/**
 * 약관 동의 설정 절 — 문서마다 동의 상태 · 동의한 판과 시각 · 문서 보기, 선택 동의는 켜고 끄기(끄기 = 철회, 이력에 남는다), 필수는 「철회 불가」 안내(방법은 계정 삭제).
 * 이력은 열 때만 가져온다. 계정 설정 화면(`@skeleton/auth` 의 `AccountSettings`) 아래에 `<ConsentSettings />` 로 붙인다.
 */
export function ConsentSettings({
  api,
  locale,
  fallbackLocale,
  facts,
  formatLocale,
  zone,
  id = 'consents',
  row = false,
  labels: given,
}: ConsentSettingsProps) {
  const labels = mergeLegalLabels(given)
  const mine = useMyConsents(api)
  const documents = useLegalDocuments(api, { enabled: mine.isSuccess })
  const agree = useAgree(api)
  const withdraw = useWithdraw(api)
  const [open, setOpen] = useState<{
    type: string
    version: string
    locale: string
    title: string
  } | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [page, setPage] = useState(0)
  const [failure, setFailure] = useState(false)
  const history = useConsentHistory(api, page)
  const fmt = (iso: string, time = false) =>
    formatWhen(iso, { locale: formatLocale ?? locale, zone, time })
  const picked = pickDocuments(documents.data ?? [], locale, fallbackLocale)
  const titleOf = (type: string) => picked.find((d) => d.type === type)?.title ?? type

  if (mine.isPending)
    return row ? (
      <SettingsRow label={labels.settingsTitle} value={<Skeleton />} />
    ) : (
      <SectionCard id={id} title={labels.settingsTitle}>
        <Skeleton />
      </SectionCard>
    )
  // legal 모듈이 없는 백엔드(401 · 403 · 404 · 405) — 스타터 · 샘플이 늘 이 절을 붙여 두므로 오류 대신 아무것도 그리지 않는다
  if (
    mine.error instanceof ApiRequestError &&
    [401, 403, 404, 405].includes(mine.error.apiError.status)
  )
    return null
  if (mine.isError || !mine.data)
    return row ? (
      <SettingsRow label={labels.settingsTitle} value={labels.settingsFailed} />
    ) : (
      <SectionCard id={id} title={labels.settingsTitle}>
        <Alert tone="danger">{labels.settingsFailed}</Alert>
      </SectionCard>
    )

  async function toggle(item: MyConsentItem, on: boolean) {
    setFailure(false)
    try {
      if (on) {
        const doc = picked.find((d) => d.type === item.type)
        const version = item.current?.version ?? doc?.version
        if (!version) return
        await agree.mutateAsync({
          consents: [{ type: item.type, version, locale: doc?.locale ?? locale }],
          source: 'settings',
        })
      } else await withdraw.mutateAsync(item.type)
    } catch {
      setFailure(true)
    }
  }

  const content = (
    <>
      {row && <p className={styles.muted}>{labels.settingsDescription}</p>}
      {failure && <Alert tone="danger">{labels.withdrawFailed}</Alert>}
      <ul className={styles.list}>
        {mine.data.items.map((item) => {
          const doc = picked.find((d) => d.type === item.type)
          const title = titleOf(item.type)
          const on = item.state === 'CURRENT' || item.state === 'GRACE'
          return (
            <li key={item.type} className={styles.item}>
              <div className={styles.head}>
                <span className={styles.title}>
                  {title}
                  <Badge tone={TONE[item.state]}>{labels.state[item.state]}</Badge>
                  <Badge>{item.required ? labels.required : labels.optional}</Badge>
                </span>
                <span>
                  {item.current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={labels.view(title)}
                      onClick={() =>
                        setOpen({
                          type: item.type,
                          version: item.current?.version ?? '',
                          locale: doc?.locale ?? locale,
                          title,
                        })
                      }
                    >
                      {labels.viewShort}
                    </Button>
                  )}
                </span>
              </div>
              <p className={styles.muted}>
                {item.agreed
                  ? labels.agreedAt(item.agreed.version, fmt(item.agreed.agreedAt, true))
                  : labels.neverAgreed}
              </p>
              {item.state === 'GRACE' && item.graceUntil && (
                <p className={styles.muted}>{labels.graceUntil(fmt(item.graceUntil))}</p>
              )}
              {item.required ? (
                <p className={styles.muted}>{labels.cannotWithdraw}</p>
              ) : (
                <Switch
                  label={title}
                  checked={on}
                  disabled={agree.isPending || withdraw.isPending}
                  onChange={(event) => void toggle(item, event.target.checked)}
                />
              )}
            </li>
          )
        })}
      </ul>
      <div className={styles.history}>
        <div>
          <Button
            variant="secondary"
            size="sm"
            aria-expanded={showHistory}
            onClick={() => setShowHistory((v) => !v)}
          >
            {labels.history}
          </Button>
        </div>
        {showHistory && history.data && (
          <>
            <Table
              caption={labels.history}
              rows={history.data.values}
              rowKey={(event) => `${event.type}-${event.version}-${event.at}`}
              empty={labels.historyEmpty}
              columns={[
                { key: 'when', header: labels.historyColumns.when, render: (e) => fmt(e.at, true) },
                {
                  key: 'doc',
                  header: labels.historyColumns.document,
                  render: (e) => titleOf(e.type),
                },
                {
                  key: 'action',
                  header: labels.historyColumns.action,
                  render: (e) => labels.historyAction[e.action],
                },
                { key: 'version', header: labels.historyColumns.version, render: (e) => e.version },
              ]}
            />
            {history.data.pagination.totalPages > 1 && (
              <Pagination
                page={history.data.pagination.page}
                totalPages={history.data.pagination.totalPages}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </div>
    </>
  )
  const documentDialog = (
    <DocumentDialog
      api={api}
      document={open}
      onClose={() => setOpen(null)}
      facts={facts}
      locale={formatLocale ?? locale}
      zone={zone}
      labels={given}
    />
  )
  if (row)
    return (
      <SettingsRow
        label={labels.settingsTitle}
        action={
          <Button
            variant="secondary"
            size="sm"
            aria-label={`${labels.settingsTitle} ${labels.viewShort}`}
            onClick={() => setDialogOpen(true)}
          >
            {labels.viewShort}
          </Button>
        }
        dialogs={
          <>
            <Dialog
              open={dialogOpen}
              onClose={() => setDialogOpen(false)}
              title={labels.settingsTitle}
              closeLabel={labels.close}
            >
              {dialogOpen && content}
            </Dialog>
            {documentDialog}
          </>
        }
      />
    )
  return (
    <SectionCard id={id} title={labels.settingsTitle} description={labels.settingsDescription}>
      {content}
      {documentDialog}
    </SectionCard>
  )
}
