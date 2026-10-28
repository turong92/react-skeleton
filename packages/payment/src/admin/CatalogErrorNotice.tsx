import { Alert, ErrorReference } from '@skeleton/ui'
import { referenceOf } from '../failure'
import { resolvePaymentLabels, type PaymentLabelsInput } from '../labels'
import { catalogProblemOf } from './catalogErrors'

/** 운영 카탈로그 호출이 실패했을 때 폼 안에서 보이는 띠 - 알려진 거절은 이유를, 그 밖은 일반 문구와 문의용 참조 번호를 */
export function CatalogErrorNotice({
  error,
  labels: input,
}: {
  error: unknown
  labels?: PaymentLabelsInput
}) {
  if (error === undefined || error === null) return null
  const labels = resolvePaymentLabels(input)
  const problem = catalogProblemOf(error)
  const reference = problem === null ? referenceOf(error) : undefined
  return (
    <>
      <Alert tone="danger" toneLabel={labels.errorLabel}>
        {labels.admin.catalog.errors[problem ?? 'other']}
      </Alert>
      {reference && (
        <ErrorReference
          reference={reference}
          label={labels.reference.label}
          copyLabel={labels.reference.copy}
          copiedLabel={labels.reference.copied}
        />
      )}
    </>
  )
}
