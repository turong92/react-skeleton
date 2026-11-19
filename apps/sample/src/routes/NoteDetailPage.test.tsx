import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Note } from '../notes/types'

// 이 앱의 시험은 DOM 없이 돈다(renderToStaticMarkup) - 상태가 노트 사이에 새는지는 리액트가 같은 자리 요소의 key 로 정한다.
// 그래서 페이지를 함수로 불러 돌려받은 요소의 key 를 본다.
const state = vi.hoisted(() => ({ id: 'a', data: { id: 'a' } as unknown as Note }))
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useParams: () => ({ id: state.id }),
}))
vi.mock('../i18n', () => ({ useT: () => ({ t: (key: string) => key }) }))
vi.mock('../notes/useNotesBase', () => ({ useNotesBase: () => '/notes' }))
vi.mock('../notes/queries', () => ({
  useNote: () => ({ isPending: false, isError: false, data: state.data }),
  useDeleteNote: () => ({}),
  useExportNote: () => ({}),
}))

import { NoteDetailPage } from './NoteDetailPage'

describe('NoteDetailPage', () => {
  it('다른 노트로 가면 앞 노트의 칸(올리기 줄 등)이 다시 마운트된다', () => {
    const at = (id: string) => {
      state.id = id
      state.data = { id } as unknown as Note
      return (NoteDetailPage() as ReactElement).key
    }
    expect(at('a')).not.toBeNull()
    expect(at('a')).not.toBe(at('b'))
  })
})
