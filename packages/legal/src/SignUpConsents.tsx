import { ApiRequestError } from '@skeleton/api-client'
import { Alert, Button, Spinner, type MarkdownFacts } from '@skeleton/ui'
import { useEffect, useMemo, useState } from 'react'
import { ConsentChecklist } from './ConsentChecklist'
import {
  consentRequestsOf,
  isSignUpComplete,
  pickDocuments,
  signUpRows,
  type ConsentRow,
} from './consentLogic'
import { DocumentDialog } from './DocumentDialog'
import { useLegalDocuments } from './hooks'
import { mergeLegalLabels, type LegalLabels } from './labels'
import type { LegalApi } from './legalApi'

/** `@skeleton/auth` 의 가입 화면이 동의 자리에 주는 것(`SignUpScreen.renderConsents`) — 구조가 같다. 이 패키지는 auth 를 import 하지 않는다 */
export type ConsentSlot = {
  /** 체크가 바뀔 때마다 — `accepted` 는 체크한 줄(`id` = 종류), `complete` 는 필수가 모두 체크됐는가 */
  onChange: (
    accepted: Array<{ id: string; version: string; locale: string }>,
    complete: boolean,
  ) => void
  /** 필수를 안 체크하고 제출을 시도했다 */
  showError: boolean
  /** 서버가 `LEGAL.CONSENT_REQUIRED` 로 문서가 바뀌었다고 하면 올라간다 — 문서 목록을 다시 읽는다 */
  refreshKey: number
}

export type SignUpConsentsProps = {
  api: LegalApi
  slot: ConsentSlot
  /** 사용자가 읽을 언어(UI 언어) */
  locale: string
  /** 그 언어가 없는 문서의 대체 언어(앱 기본 언어) */
  fallbackLocale?: string
  facts?: MarkdownFacts
  /** 날짜 서식 로케일 · 시간대(`locale` 과 다를 때) */
  formatLocale?: string
  zone?: string
  labels?: Partial<LegalLabels>
}

/**
 * 이 백엔드에는 legal 모듈이 없다 — 공개 경로(`GET /documents`)가 모듈이 있으면 늘 열려 있으니 404 뿐 아니라 401 · 403 · 405 도 「없음」이다
 * (출시된 백엔드는 모르는 경로를 401 로 답한다 — e2e 로 확인). 네트워크 오류 · 5xx 는 일시 실패라 가입을 막고 다시 시도를 준다.
 */
const isNotFound = (error: unknown) =>
  error instanceof ApiRequestError && [401, 403, 404, 405].includes(error.apiError.status)

/**
 * 가입 폼의 동의 자리 — `GET /legal/documents` 로 체크박스를 만든다(필수 · 선택 · 전체 동의 · 줄마다 문서 다이얼로그).
 * 체크한 줄의 `{종류, 판, 언어}` 가 슬롯으로 올라가 가입 요청의 `consents` 가 된다. 백엔드에 legal 모듈이 없으면(404 · 401) 아무것도 그리지 않고 가입을 막지 않는다.
 */
export function SignUpConsents({
  api,
  slot,
  locale,
  fallbackLocale,
  facts,
  formatLocale,
  zone,
  labels: given,
}: SignUpConsentsProps) {
  const labels = mergeLegalLabels(given)
  const documents = useLegalDocuments(api)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [open, setOpen] = useState<ConsentRow | null>(null)
  const rows = useMemo(
    () => signUpRows(pickDocuments(documents.data ?? [], locale, fallbackLocale)),
    [documents.data, locale, fallbackLocale],
  )
  const unavailable = documents.isError && isNotFound(documents.error)
  const { onChange } = slot

  useEffect(() => {
    if (documents.isError && !unavailable) return onChange([], false) // 불러오지 못했다 — 동의 없이 보내지 못하게
    if (documents.isPending) return onChange([], false)
    onChange(
      consentRequestsOf(rows, checked).map((c) => ({
        id: c.type,
        version: c.version,
        locale: c.locale ?? locale,
      })),
      isSignUpComplete(rows, checked),
    )
  }, [rows, checked, documents.isError, documents.isPending, unavailable, onChange, locale])

  const { refetch } = documents
  useEffect(() => {
    if (slot.refreshKey > 0) void refetch()
  }, [slot.refreshKey, refetch])

  // 문서가 바뀌어 줄이 사라지거나 판이 바뀌었다 — 이미 한 체크는 종류 기준으로 남긴다(사용자는 판이 아니라 문서에 동의하려는 것이지만, 새 판은 다이얼로그로 다시 읽을 수 있다)
  if (unavailable) return null
  if (documents.isPending)
    return (
      <p aria-live="polite">
        <Spinner label={labels.loadingDocuments} /> {labels.loadingDocuments}
      </p>
    )
  if (documents.isError)
    return (
      <Alert
        tone="danger"
        action={
          <Button size="sm" variant="secondary" onClick={() => void refetch()}>
            {labels.retry}
          </Button>
        }
      >
        {labels.documentsFailed}
      </Alert>
    )
  if (rows.length === 0) return null
  return (
    <>
      <ConsentChecklist
        rows={rows}
        checked={checked}
        onChange={setChecked}
        onOpen={setOpen}
        showError={slot.showError}
        labels={given}
      />
      <DocumentDialog
        api={api}
        document={open}
        onClose={() => setOpen(null)}
        facts={facts}
        locale={formatLocale ?? locale}
        zone={zone}
        labels={given}
      />
    </>
  )
}
