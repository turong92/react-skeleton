import { ErrorCodes } from '@skeleton/api-client'
import { Button, Table } from '@skeleton/ui'
import { useState } from 'react'
import { Case } from '../components/Section'
import { runApiErrorCases, type ErrorCase } from '../fakes/apiErrorCases'

/** 결과 표 — 각 줄은 `isErrorCode(error, ErrorCodes.AUTH_INVALID_CREDENTIALS)` 의 결과 */
export function ErrorCaseTable({ cases }: { cases: ErrorCase[] }) {
  return (
    <Table
      caption="isErrorCode(error, AUTH_INVALID_CREDENTIALS)"
      columns={[
        {
          key: 'path',
          header: '요청',
          render: (c: ErrorCase) => <code>{c.path}</code>,
          rowHeader: true,
        },
        { key: 'status', header: 'status', render: (c) => c.status, align: 'end' },
        { key: 'code', header: 'apiError.code', render: (c) => <code>{c.code}</code> },
        { key: 'is', header: 'isErrorCode', render: (c) => String(c.isInvalidCredentials) },
      ]}
      rows={cases}
      rowKey={(c) => c.path}
      empty="아래 버튼으로 실행"
    />
  )
}

/** 진짜 `createApiClient` 를 가짜 어댑터 위에서 실패시킨다 — 에러는 `ApiRequestError`, 갈래는 에러 코드 */
export function ApiClientDemo() {
  const [cases, setCases] = useState<ErrorCase[]>([])
  return (
    <>
      <Case label="createApiClient({ baseUrl, adapter })">
        <Button variant="secondary" onClick={() => void runApiErrorCases().then(setCases)}>
          세 요청 보내 보기
        </Button>
      </Case>
      <ErrorCaseTable cases={cases} />
      <p>
        코드는 백엔드 enum 에 있는 것만 <code>ErrorCodes</code> 에 둔다(예:{' '}
        <code>{ErrorCodes.COMMON_NOT_FOUND}</code>). 응답을 못 해석하면 <code>CLIENT.*</code> 코드를
        클라이언트가 채운다.
      </p>
    </>
  )
}
