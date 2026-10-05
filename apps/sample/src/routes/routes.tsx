import { RequireAuth } from '@skeleton/auth'
import type { RouteObject } from 'react-router-dom'
import { RootLayout } from '../layouts/RootLayout'
import { BoardFormPage } from './BoardFormPage'
import { BoardPage } from './BoardPage'
import { BoardPostPage } from './BoardPostPage'
import { DashboardPage } from './DashboardPage'
import { LoginPage } from './LoginPage'
import { NoteDetailPage } from './NoteDetailPage'
import { NoteFormPage } from './NoteFormPage'
import { NotesPage } from './NotesPage'
import { NotFoundPage } from './NotFoundPage'
import { SettingsPage } from './SettingsPage'

/**
 * 라우트 정의 — path → page 매핑은 여기. 로그인해야 보이는 화면은 `RequireAuth` 아래(비로그인은 `/login`, 돌아올 위치를 기억한다).
 * `/notes/new` 는 `/notes/:id` 보다 먼저 맞는다(React Router 가 더 구체적인 경로를 고른다) — `/board/new` 도 같다.
 */
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/notes', element: <NotesPage /> },
          { path: '/notes/new', element: <NoteFormPage /> },
          { path: '/notes/:id', element: <NoteDetailPage /> },
          { path: '/notes/:id/edit', element: <NoteFormPage /> },
          { path: '/board', element: <BoardPage /> },
          { path: '/board/new', element: <BoardFormPage /> },
          { path: '/board/:id', element: <BoardPostPage /> },
          { path: '/board/:id/edit', element: <BoardFormPage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
