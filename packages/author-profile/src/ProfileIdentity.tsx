import styles from './AuthorPicker.module.css'

/** 화면에 그릴 프로필 — `name` 은 이름이 없을 때의 말(「Unnamed」)이 이미 들어간 글자, `tag` 는 없으면 null */
export type ProfileParts = { name: string; tag: string | null }

/**
 * `이름#꼬리표` — **이름 부분만** 넘치면 말줄임이고 꼬리표는 고정이다(잘리지 않는다). 접힌 단추 · 메뉴 항목 · 확인 단추가 같은 구조를 쓴다.
 * 이름과 꼬리표 사이에 글자도 간격도 없다 — 보이는 모양은 문장 속 `이름#꼬리표` 와 같다. 칸이 둘로 나뉘어 낭독기가 사이에 끊김을 넣을 수 있으니
 * **쓰는 쪽이 전체 `이름#꼬리표` 를 `aria-label` 로 준다**(접힌 단추 · 메뉴 항목 · 확인 단추 모두 그렇게 한다).
 */
export function ProfileIdentity({ name, tag }: ProfileParts) {
  return (
    <span className={styles.identity}>
      <span className={styles.nameEllipsis}>{name}</span>
      {tag && <span className={styles.tagFixed}>{`#${tag}`}</span>}
    </span>
  )
}
