import { AppShell, Button, Spinner } from '@skeleton/ui'
import { Case } from '../../components/Section'
import { BoundaryDemo, DialogDemo } from './OverlayDemos'
import styles from './overlay.module.css'
import type { UiEntry } from '../types'

export const overlayEntries: UiEntry[] = [
  {
    name: 'Dialog',
    title: '대화상자',
    render: () => <DialogDemo />,
  },
  {
    name: 'Spinner',
    title: '스피너 — 기본 · 이름 지정',
    render: () => (
      <>
        <Case label="default (Loading)">
          <Spinner />
        </Case>
        <Case label="label">
          <Spinner label="불러오는 중" />
        </Case>
      </>
    ),
  },
  {
    name: 'AppShell',
    title: '앱 틀 — 헤더 · 본문 · 푸터',
    render: () => (
      <div className={styles.frame}>
        <AppShell
          brand={<strong>brand</strong>}
          nav={<a href="#shell">홈</a>}
          actions={<Button size="sm">행동</Button>}
          footer="푸터"
        >
          <p>본문</p>
        </AppShell>
      </div>
    ),
  },
  {
    name: 'ErrorBoundary',
    title: '에러 경계 — 렌더링 에러를 잡는다',
    render: () => <BoundaryDemo />,
  },
]
