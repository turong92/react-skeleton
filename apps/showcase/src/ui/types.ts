import type { ReactNode } from 'react'

/** 갤러리 한 칸 — 새 부품은 entries/*.tsx 에 한 줄(테스트가 `@skeleton/ui` 의 export 와 대조한다) */
export type UiEntry = {
  /** `@skeleton/ui` 의 export 이름 */
  name: string
  title: string
  render: () => ReactNode
}

export const importLineOf = (name: string) => `import { ${name} } from '@skeleton/ui'`
