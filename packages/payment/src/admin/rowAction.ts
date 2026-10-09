import type { ReactNode } from 'react'
import styles from './shared.module.css'

/** 줄 끝 행동의 링크 모양 클래스 — `renderAction` 이 라우터 링크에 붙이도록 건네는 값 */
export const rowActionClass: string = styles.actionLink ?? ''

/**
 * 줄 끝 컨트롤을 바꿔 끼운다(라우터의 `<Link>`) — 인자: 줄 · 보이는 글자 · 낭독 이름(보이는 글자로 시작) ·
 * **버튼 모양 클래스**(날 `<a>` 는 밑줄도 테두리도 없는 본문 글자로 그려지니 링크의 `className` 에 꼭 붙인다)
 */
export type RenderRowAction<Row> = (
  row: Row,
  label: string,
  accessibleName: string,
  buttonLikeClassName: string,
) => ReactNode
