import { Button, Switch } from '@skeleton/ui'
import type { DragEvent, ReactNode } from 'react'
import type { DashboardLabels } from './labels'
import styles from './DashboardEditor.module.css'

export type EditControlsProps = {
  editing: boolean
  saving: boolean
  onEdit: () => void
  onDone: () => void
  onReset: () => void
  /** 고친 것을 버리고 편집에서 나온다(저장이 실패해도 갇히지 않게) */
  onCancel: () => void
  labels: Pick<DashboardLabels, 'edit'>
}

/** 헤더 오른쪽의 「편집」 / 「완료」 단추(눌린 모양) - 편집 중에는 「기본 배치로」도 */
export function EditControls({
  editing,
  saving,
  onEdit,
  onDone,
  onReset,
  onCancel,
  labels,
}: EditControlsProps) {
  return (
    <>
      {editing && (
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {labels.edit.cancel}
        </Button>
      )}
      {editing && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          {labels.edit.reset}
        </Button>
      )}
      <Button
        size="sm"
        variant={editing ? 'primary' : 'secondary'}
        aria-pressed={editing}
        loading={saving}
        loadingLabel={labels.edit.saving}
        onClick={editing ? onDone : onEdit}
      >
        {editing ? labels.edit.done : labels.edit.edit}
      </Button>
    </>
  )
}

export type EditableCardProps = {
  /** 카드 키 */
  id: string
  /** 낭독 · 자리표시에 쓰는 카드 이름 */
  name: string
  /** 가로 전체를 쓰는 카드(퍼널 · 앱 통계) */
  wide?: boolean
  editing: boolean
  hidden: boolean
  isFirst: boolean
  isLast: boolean
  onToggle: () => void
  onMove: (delta: number) => void
  onDragStart: (id: string) => void
  onDropOn: (id: string) => void
  labels: Pick<DashboardLabels, 'edit'>
  children: ReactNode
}

/**
 * 카드 한 장의 편집 틀 - 편집 중이 아니면 내용만(꺼진 카드는 아예 안 그린다), 편집 중이면 점선 테두리 + 켜기/끄기 스위치 + ▲▼(폰에서도 된다) 이고
 * 넓은 화면에서는 끌어서 옮길 수도 있다. 꺼진 카드는 자리에 「꺼짐」 표시와 스위치만 남는다.
 */
export function EditableCard({
  id,
  name,
  wide,
  editing,
  hidden,
  isFirst,
  isLast,
  onToggle,
  onMove,
  onDragStart,
  onDropOn,
  labels,
  children,
}: EditableCardProps) {
  if (!editing) {
    return hidden ? null : (
      <div className={styles.cell} data-wide={wide || undefined}>
        {children}
      </div>
    )
  }
  const over = (event: DragEvent) => event.preventDefault()
  return (
    <div
      className={styles.cell}
      data-wide={wide || undefined}
      data-editing="true"
      data-off={hidden || undefined}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', id)
        event.dataTransfer.effectAllowed = 'move'
        onDragStart(id)
      }}
      onDragOver={over}
      onDrop={(event) => {
        event.preventDefault()
        onDropOn(id)
      }}
    >
      <div className={styles.bar}>
        <Switch label={labels.edit.show(name)} checked={!hidden} onChange={onToggle} />
        <span className={styles.moves}>
          <Button
            variant="ghost"
            size="sm"
            aria-label={labels.edit.moveUp(name)}
            disabled={isFirst}
            onClick={() => onMove(-1)}
          >
            <span aria-hidden="true">▲</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={labels.edit.moveDown(name)}
            disabled={isLast}
            onClick={() => onMove(1)}
          >
            <span aria-hidden="true">▼</span>
          </Button>
        </span>
      </div>
      {hidden ? <p className={styles.gone}>{labels.edit.off(name)}</p> : children}
    </div>
  )
}
