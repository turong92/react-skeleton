import { revealControl } from './revealControl'
import styles from './FormProblems.module.css'

export type FormProblem = {
  /** 목록의 키 */
  key: string
  /** 사용자가 읽는 한 줄 — 「필수 약관에 동의해 주세요」 */
  message: string
  /** 누르면 포커스가 갈 칸(또는 칸을 감싼 상자)의 `id` */
  target?: string
}

export type FormProblemsProps = {
  /** 목록 머리글 — 「아래 항목을 확인해 주세요」 */
  title: string
  problems: readonly FormProblem[]
}

/**
 * 제출 버튼 바로 위에 두는 오류 요약 — 무엇이 비었거나 틀렸는지 한 곳에 모으고, 줄마다 그 칸으로 데려가는 버튼이다.
 * 비어 있으면 아무것도 그리지 않는다(빈 알림이 낭독되지 않게). 칸 옆의 오류 문구는 그대로 두고 이 요약이 「놓칠 수 없는」 자리를 맡는다.
 */
export function FormProblems({ title, problems }: FormProblemsProps) {
  if (problems.length === 0) return null
  return (
    <div role="alert" className={styles.root}>
      <p className={styles.title}>{title}</p>
      <ul className={styles.list}>
        {problems.map((problem) => (
          <li key={problem.key}>
            <button
              type="button"
              className={styles.item}
              onClick={() => revealControl(problem.target)}
            >
              {problem.message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
