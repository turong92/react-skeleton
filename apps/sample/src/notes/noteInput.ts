import type { Note, NoteInput } from './types'

/**
 * 노트 고치기(PUT) 본문 — 지금 노트에서 출발해 바뀐 칸만 덮는다.
 * 서버는 PUT 을 노트 통째로 바꾸므로 `attachmentKey` · `videoId` 를 빼면 붙은 파일 · 영상이 떨어지고 서버가 영상을 지운다.
 * 노트를 고치는 화면은 직접 객체를 짓지 말고 이것을 거친다.
 */
export const noteInputOf = (note: Note, change: Partial<NoteInput> = {}): NoteInput => ({
  title: note.title,
  body: note.body,
  status: note.status,
  pinned: note.pinned,
  attachmentKey: note.attachmentKey,
  attachmentName: note.attachmentName,
  videoId: note.videoId,
  ...change,
})
