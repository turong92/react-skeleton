import type { FakeStore } from './fakeBoardStore'

/** 데모 글 · 댓글 — 고정 공지, 반응이 있는 글, 댓글 트리가 깊은 글(삭제 · 숨김 자리 표시 포함) */
export function seedDemo({ newPost, newComment }: Pick<FakeStore, 'newPost' | 'newComment'>) {
  newPost(
    'Welcome to the board',
    'Be kind. Use the reaction buttons instead of +1 comments.',
    'admin',
    {
      pinned: true,
      reactionCounts: { LIKE: 12, DISLIKE: 0 },
    },
  )
  newPost(
    'How do you organize your notes?',
    'I keep everything in one folder. What about you?',
    'alice',
    {
      reactionCounts: { LIKE: 4, DISLIKE: 1 },
    },
  )
  const thread = newPost('Tabs or spaces?', 'The eternal question. Reply below.', 'bob')
  const first = newComment(thread.id, 'Spaces, always.', null, 'alice')
  const second = newComment(thread.id, 'Tabs — they are accessible.', first.id, 'bob')
  newComment(thread.id, 'Both are fine if the formatter decides.', second.id, 'carol')
  newComment(thread.id, 'Agree with the formatter.', second.id, 'dave')
  newComment(thread.id, 'A comment that was removed.', null, 'erin').status = 'DELETED'
  newComment(thread.id, 'Nobody asked for this.', null, 'frank').status = 'HIDDEN'
}
