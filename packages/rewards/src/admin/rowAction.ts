import type { ReactNode } from 'react'
import styles from './shared.module.css'

/** 줄 끝 링크의 버튼 모양 클래스 - `renderDetailLink` 이 라우터 링크에 붙이도록 건넨다(날 `<a>` 는 테두리 없는 글자로 그려진다) */
export const rowActionClass: string = styles.actionLink ?? ''

/**
 * 줄 끝 링크를 바꿔 끼운다(라우터의 `<Link>`) - 인자: 줄 · 보이는 글자 · 낭독 이름(보이는 글자로 시작) · **버튼 모양 클래스**.
 * 패키지는 라우터를 모른다
 */
export type RenderRowLink<Row> = (
  row: Row,
  label: string,
  accessibleName: string,
  buttonLikeClassName: string,
) => ReactNode
