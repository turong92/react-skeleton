import { useId, useState } from 'react'
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
 * 요약이 나타나는 순간 **한 번만** 낭독하는 영역 — 글자는 처음 그려질 때 고정된다. 목록은 낭독 영역이 아니라서, 고치며 타이핑할 때마다
 * 남은 목록 전체를 다시 읽지 않는다(포커스가 첫 틀린 칸으로 가며 그 칸의 오류가 읽힌다). 목록이 비었다가 다시 생기면 새로 낭독된다
 */
function Announce({ text }: { text: string }) {
  const [frozen] = useState(text)
  return (
    <div role="alert" className={styles.srOnly}>
      {frozen}
    </div>
  )
}

/**
 * 제출 버튼 바로 위에 두는 오류 요약 — 무엇이 비었거나 틀렸는지 한 곳에 모으고, 줄마다 그 칸으로 데려가는 버튼이다.
 * 비어 있으면 아무것도 그리지 않는다(빈 알림이 낭독되지 않게). 칸 옆의 오류 문구는 그대로 두고 이 요약이 「놓칠 수 없는」 자리를 맡는다.
 */
export function FormProblems({ title, problems }: FormProblemsProps) {
  const titleId = useId()
  if (problems.length === 0) return null
  return (
    <div role="group" aria-labelledby={titleId} className={styles.root}>
      <Announce text={title} />
      <p id={titleId} className={styles.title}>
        {title}
      </p>
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
