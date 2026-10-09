import { Button, SettingsRow } from '@skeleton/ui'
import type { ReactNode } from 'react'
import { mergeLabels, type AuthLabels } from './labels'
import { SectionShell } from './SectionShell'

export type NeedsEmailCardProps = {
  /** 접은 구역의 id - 목차(`SectionIndex`)가 가리키는 그대로 */
  id: string
  title: ReactNode
  /** 이메일 구역으로 간다. 없으면(그 구역을 끈 앱) 단추를 그리지 않는다 */
  onGo?: () => void
  labels?: Partial<AuthLabels>
  /** 줄만 그린다(`AccountSettings` 의 카드 안) - 아니면 제목 있는 카드 한 장에 담는다 */
  row?: boolean
}

/**
 * 쓰기 때 방식의 서버에서 **주소가 없는 계정**이 여는 설정: 비밀번호 · 연락받을 이메일 · 로그인 수단은 변경 요청이라 서버가 `403 ACCOUNT.EMAIL_REQUIRED` 로 막는다
 * (주소가 먼저다 - 스펙 §9.3). 눌러 보고 「문제가 생겼어요」를 보게 하지 않고, 그 항목을 이유 한 줄(값 자리) + 테두리 단추 「이메일 등록」(이메일 항목으로)으로 접는다 - 꺼진 단추는 두지 않는다.
 */
export function NeedsEmailCard({ id, title, onGo, labels: given, row }: NeedsEmailCardProps) {
  const labels = mergeLabels(given)
  return (
    <SectionShell row={row} id={id} title={title}>
      <SettingsRow
        label={title}
        value={labels.settingsNeedsEmail}
        action={
          onGo && (
            <Button variant="secondary" size="sm" onClick={onGo}>
              {labels.emailRequiredWriteNoticeAction}
            </Button>
          )
        }
      />
    </SectionShell>
  )
}
