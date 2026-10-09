import { SettingsGroup } from '@skeleton/ui'
import type { ReactNode } from 'react'

/**
 * 구역 부품이 줄(`SettingsRow`)을 그리는 틀. `row` 이면 줄만 내보내 `AccountSettings` 의 카드 안에 들어가고,
 * 아니면(구역 부품을 따로 쓰는 앱) 제목 있는 카드 한 장에 그 줄 하나를 담는다
 */
export function SectionShell({
  row,
  id,
  title,
  children,
}: {
  row?: boolean
  id: string
  title: ReactNode
  children: ReactNode
}) {
  return row ? (
    <>{children}</>
  ) : (
    <SettingsGroup id={id} title={title}>
      {children}
    </SettingsGroup>
  )
}
