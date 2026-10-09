import { useId, type ReactNode } from 'react'
import { SectionCard } from '../SectionCard/SectionCard'
import styles from './SettingsRow.module.css'

export type SettingsRowProps = {
  /** 항목 이름(왼쪽) */
  label: ReactNode
  /** 이름 요소의 id - 이 줄의 양식이 `aria-labelledby` 로 가리킬 때 */
  labelId?: string
  /** 현재 값(가운데) - 짧은 상태 문구 */
  value?: ReactNode
  /** 오른쪽 단추(들) - 테두리형, 위험 동작만 위험색 테두리 */
  action?: ReactNode
  /** 줄 아래 보조 한 줄 · 결과 알림 */
  children?: ReactNode
  /** 이 줄의 단추가 여는 대화상자들 - 줄 안에 두어 이름으로 줄을 찾으면 그 안의 대화상자도 함께 잡힌다(닫혀 있으면 자리를 차지하지 않는다) */
  dialogs?: ReactNode
}

/**
 * 설정의 한 항목 한 줄 - 왼쪽 이름, 가운데 현재 값, 오른쪽 단추. 좁은 화면에서는 이름이 위, 값과 단추가 그 아래 줄로 접힌다(가로로 밀리지 않는다).
 * 긴 설명 · 입력은 줄에 두지 않고 단추가 여는 대화상자에 둔다
 */
export function SettingsRow({
  label,
  labelId,
  value,
  action,
  children,
  dialogs,
}: SettingsRowProps) {
  const uid = useId()
  const nameId = labelId ?? `${uid}-label`
  return (
    <div className={styles.row} role="group" aria-labelledby={nameId}>
      <span id={nameId} className={styles.label}>
        {label}
      </span>
      {value !== undefined && value !== null && <div className={styles.value}>{value}</div>}
      {action && <div className={styles.action}>{action}</div>}
      {children && <div className={styles.extra}>{children}</div>}
      {dialogs}
    </div>
  )
}

export type SettingsGroupProps = {
  /** 목차(`SectionIndex`)의 앵커 */
  id: string
  title: ReactNode
  /** `SettingsRow` 들 */
  children: ReactNode
}

/** 설정 카드 한 장 - 제목과, 구분선으로 이어진 `SettingsRow` 들 */
export function SettingsGroup({ id, title, children }: SettingsGroupProps) {
  return (
    <SectionCard id={id} title={title}>
      <div className={styles.rows}>{children}</div>
    </SectionCard>
  )
}
