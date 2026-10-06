import type { Decorator } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'

/** 스토리용 라우터 — 링크(`Link`)가 라우터 문맥을 요구한다 */
export const withRouter: Decorator = (Story) => (
  <MemoryRouter>
    <Story />
  </MemoryRouter>
)
