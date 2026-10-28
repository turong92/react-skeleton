import { ApiRequestError } from '@skeleton/api-client'
import { Alert, ErrorReference } from '@skeleton/ui'
import { referenceOf } from '../failure'
import { resolvePaymentLabels, type PaymentLabelsInput } from '../labels'
import { catalogProblemOf } from './catalogErrors'

/** 운영 카탈로그 호출이 실패했을 때 폼 안에서 보이는 띠 - 알려진 거절은 이유를, 그 밖은 일반 문구와 문의용 참조 번호를 */
export function CatalogErrorNotice({
  error,
  context,
  labels: input,
}: {
  error: unknown
  /** `providerLink` - 결제사 가격 id 를 잇는 칸의 오류. 같은 코드(`CODE_TAKEN`)가 「이미 다른 가격에 이어진 id」를 뜻한다 */
  context?: 'providerLink'
  labels?: PaymentLabelsInput
}) {
  if (error === undefined || error === null) return null
  const labels = resolvePaymentLabels(input)
  const problem = catalogProblemOf(error)
  // 칸 이름이 있는 입력 오류는 칸 아래에 이유가 있다. 칸 이름이 없거나(또는 칸이 없는 결제사 링크 줄이면) 서버의 한 줄 설명(`detail`)을 띠에 보인다
  const fields = error instanceof ApiRequestError ? (error.apiError.errors ?? []) : []
  const extra =
    (problem === 'invalidInput' || problem === 'priceInvalid') && error instanceof ApiRequestError
      ? fields.length > 0 && context !== 'providerLink'
        ? ''
        : (error.apiError.detail ?? fields[0]?.message ?? '')
      : ''
  const reference = problem === null ? referenceOf(error) : undefined
  return (
    <>
      <Alert tone="danger" toneLabel={labels.errorLabel}>
        {
          labels.admin.catalog.errors[
            context === 'providerLink' && problem === 'codeTaken'
              ? 'refTaken'
              : (problem ?? 'other')
          ]
        }
        {extra ? ` ${extra}` : ''}
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
