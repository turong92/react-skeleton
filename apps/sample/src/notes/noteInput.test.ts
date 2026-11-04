import { describe, expect, it } from 'vitest'
import { noteInputOf } from './noteInput'
import type { Note } from './types'

const note: Note = {
  id: 'n1',
  title: '장보기',
  body: '우유',
  status: 'ACTIVE',
  pinned: true,
  attachmentKey: 'k/a.pdf',
  attachmentName: 'a.pdf',
  videoId: 'v1',
  createdAt: '2026-11-04T00:00:00Z',
  updatedAt: '2026-11-04T00:00:00Z',
}

describe('noteInputOf', () => {
  // PUT /notes/{id} replaces the whole note: a body without videoId detaches the video and the server deletes it
  it('keeps the video (and the attachment) when only the title changes', () => {
    expect(noteInputOf(note, { title: '새 제목' })).toEqual({
      title: '새 제목',
      body: '우유',
      status: 'ACTIVE',
      pinned: true,
      attachmentKey: 'k/a.pdf',
      attachmentName: 'a.pdf',
      videoId: 'v1',
    })
  })

  it('keeps the video when the attachment is removed', () => {
    const input = noteInputOf(note, { attachmentKey: null, attachmentName: null })
    expect(input.videoId).toBe('v1')
    expect(input.attachmentKey).toBeNull()
  })

  it('lets the caller attach or drop the video explicitly', () => {
    expect(noteInputOf({ ...note, videoId: null }, { videoId: 'v2' }).videoId).toBe('v2')
    expect(noteInputOf(note, { videoId: null }).videoId).toBeNull()
  })
})
