import { useState, type ReactNode } from 'react'
import { defaultRewardsLabels, type RewardsLabels } from '../labels'
import styles from './BadgeTile.module.css'

export type BadgeTileProps = {
  /** `earned` 받음 · `locked` 아직(흐리게) · `hidden` 아직이고 숨은 업적(「?」) */
  state: 'earned' | 'locked' | 'hidden'
  name: string | null
  description?: string | null
  /** 그림 주소 - 없으면 이름 첫 글자를 원 안에 그린다 */
  imageUrl?: string | null
  /** 그림을 앱 방식으로 그린다(예: 최적화 이미지). 안 주면 `<img>` */
  renderImage?: (src: string, name: string) => ReactNode
  /** `sm` 은 프로필 줄 */
  size?: 'sm' | 'md'
  labels?: RewardsLabels
  /** 이름 아래에 더할 것(받은 날 · 스위치 등) */
  children?: ReactNode
}

function Picture({
  src,
  name,
  renderImage,
}: {
  src: string
  name: string
  renderImage?: BadgeTileProps['renderImage']
}) {
  const [failed, setFailed] = useState<string | null>(null)
  if (failed === src) return <span aria-hidden="true">{firstLetter(name)}</span>
  if (renderImage) return <>{renderImage(src, name)}</>
  return <img className={styles.image} src={src} alt="" onError={() => setFailed(src)} />
}

const firstLetter = (name: string) => Array.from(name.trim())[0]?.toUpperCase() ?? ''

/** 배지 한 개 — 그림(주소) 또는 첫 글자 원 + 이름 + 설명. 숨은 업적은 「?」 */
export function BadgeTile({
  state,
  name,
  description,
  imageUrl,
  renderImage,
  size = 'md',
  labels = defaultRewardsLabels,
  children,
}: BadgeTileProps) {
  const hidden = state === 'hidden'
  const shownName = hidden ? labels.badge.hiddenName : (name ?? '')
  return (
    <div className={styles.tile} data-state={state} data-size={size}>
      <span className={styles.circle} aria-hidden="true">
        {hidden ? (
          <span aria-hidden="true">?</span>
        ) : imageUrl ? (
          <Picture src={imageUrl} name={shownName} renderImage={renderImage} />
        ) : (
          <span aria-hidden="true">{firstLetter(shownName)}</span>
        )}
      </span>
      <span className={styles.name}>{shownName}</span>
      {hidden ? (
        <span className={styles.description}>{labels.badge.hiddenHint}</span>
      ) : (
        description && (
          // 작은 줄(프로필)은 설명을 눈에는 안 보이고 낭독기에만 읽어 준다
          <span className={size === 'md' ? styles.description : styles.srOnly}>{description}</span>
        )
      )}
      {children}
    </div>
  )
}
