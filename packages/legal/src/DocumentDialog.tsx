import { Alert, Button, Dialog, Spinner, type MarkdownFacts } from '@skeleton/ui'
import { useLegalDocument } from './hooks'
import { mergeLegalLabels, type LegalLabels } from './labels'
import type { LegalApi } from './legalApi'
import { LegalDocumentView } from './LegalDocumentView'

export type DocumentDialogProps = {
  api: LegalApi
  /** 열 문서 — 체크리스트 줄이 보여 준 판 · 언어 그대로(사용자가 읽은 것에 동의한다) */
  document: { type: string; version: string; locale: string; title: string } | null
  onClose: () => void
  facts?: MarkdownFacts
  locale?: string
  zone?: string
  labels?: Partial<LegalLabels>
}

/** 문서를 다이얼로그로 읽는다 — 닫으면 포커스가 누른 「보기」로 돌아간다(`Dialog`). 열릴 때만 가져온다 */
export function DocumentDialog({
  api,
  document: row,
  onClose,
  facts,
  locale,
  zone,
  labels: given,
}: DocumentDialogProps) {
  const labels = mergeLegalLabels(given)
  const query = useLegalDocument(api, row?.type ?? '', {
    version: row?.version,
    locale: row?.locale,
    enabled: !!row,
  })
  return (
    <Dialog open={!!row} onClose={onClose} title={row?.title ?? ''} closeLabel={labels.close}>
      {query.isPending && row && (
        <p>
          <Spinner label={labels.loadingDocuments} /> {labels.loadingDocuments}
        </p>
      )}
      {query.isError && (
        <Alert
          tone="danger"
          action={
            <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>
              {labels.retry}
            </Button>
          }
        >
          {labels.documentFailed}
        </Alert>
      )}
      {query.data && (
        <LegalDocumentView
          document={query.data}
          showTitle={false}
          headingOffset={2}
          facts={facts}
          locale={locale}
          zone={zone}
          labels={given}
        />
      )}
    </Dialog>
  )
}
