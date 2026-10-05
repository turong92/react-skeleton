import { useState } from 'react'
import styles from './Avatar.module.css'
import { initialsOf, toneOf } from './initials'

export type AvatarProps = {
  /** 사람 이름 — 사진이 없으면 머리글자, 접근 가능한 이름은 항상 이것 */
  name: string
  src?: string
  /** 사진의 `alt`(기본 이름). 이름이 옆에 이미 보이면 `""` */
  alt?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/** 사람 아바타 — 사진, 불러오지 못하면(또는 없으면) 머리글자. 색은 이름에서 정해진다 */
export function Avatar({ name, src, alt, size = 'md', className }: AvatarProps) {
  const [failed, setFailed] = useState<string | null>(null)
  const classes = [styles.avatar, className].filter(Boolean).join(' ')
  if (src && failed !== src)
    return (
      <span className={classes} data-size={size}>
        <img className={styles.image} src={src} alt={alt ?? name} onError={() => setFailed(src)} />
      </span>
    )
  return (
    <span
      className={classes}
      data-size={size}
      data-tone={toneOf(name)}
      role="img"
      aria-label={name}
    >
      <span aria-hidden="true">{initialsOf(name)}</span>
    </span>
  )
}
