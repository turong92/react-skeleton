import { Avatar } from '@skeleton/ui'
import {
  defaultAuthorLabels,
  resolveAuthor,
  showsTag,
  type AuthorFields,
  type AuthorLabels,
  type AuthorTagMode,
} from './authorDisplay'
import styles from './AuthorName.module.css'

export type AuthorNameProps = {
  author: AuthorFields
  labels?: Partial<AuthorLabels>
  /** 아바타를 뺀다(좁은 자리) */
  hideAvatar?: boolean
  /** 꼬리표를 보일 때(기본 `collision`) */
  tag?: AuthorTagMode
  /** 긴 이름을 한 줄 말줄임으로(좁은 열) — 전체 글자는 DOM 에 그대로라 스크린 리더는 전체를 읽는다 */
  truncate?: boolean
  /** 같은 화면에 같은 닉네임의 다른 계정이 있는가 — `collision` 일 때만 본다(부모가 `collidingNames` 로 안다) */
  collides?: boolean
}

/**
 * 작성자 한 사람 — 아바타 + 이름. 규칙은 `resolveAuthor`(닉네임 → 「탈퇴한 사용자」 → 「이름 없는 사용자」).
 * 계정 id 는 그리지 않는다. 아바타는 스크린 리더에서 숨겨 이름이 한 번만 읽힌다.
 */
export function AuthorName({
  author,
  labels,
  hideAvatar,
  truncate,
  tag = 'collision',
  collides = false,
}: AuthorNameProps) {
  const resolved = resolveAuthor(author, { ...defaultAuthorLabels, ...labels })
  return (
    <span className={styles.author} data-kind={resolved.kind} data-truncate={truncate || undefined}>
      {!hideAvatar && (
        <span aria-hidden="true" className={styles.avatar}>
          <Avatar name={resolved.name} size="sm" />
        </span>
      )}
      <bdi className={styles.name}>{resolved.name}</bdi>
      {showsTag(tag, collides, resolved.tag) && <span className={styles.tag}>#{resolved.tag}</span>}
    </span>
  )
}
