import { describe, expect, it } from 'vitest'
import { fakeItem } from './test/item'
import { failReasonKey, formatDuration, isBusy, phaseOf, pollInterval } from './videoView'

describe('phaseOf', () => {
  it('follows the life of a video', () => {
    expect(phaseOf(fakeItem({ status: 'QUEUED' }), true)).toEqual({
      phase: 'processing',
      percent: null,
    })
    expect(phaseOf(fakeItem({ status: 'REMUXING', progress: 40 }), true)).toEqual({
      phase: 'processing',
      percent: 40,
    })
    expect(phaseOf(fakeItem({ compat: 'RUNNING' }), true)).toEqual({ phase: 'extras' })
    expect(phaseOf(fakeItem({ ladder: 'QUEUED' }), true)).toEqual({ phase: 'extras' })
    expect(phaseOf(fakeItem(), true)).toEqual({ phase: 'ready' })
  })

  it('keeps a video playable even when a track failed', () => {
    expect(phaseOf(fakeItem({ compat: 'FAILED', ladder: 'FAILED' }), true)).toEqual({
      phase: 'ready',
    })
  })

  it('shows the fail code, and treats an upload nobody here is running as abandoned', () => {
    expect(phaseOf(fakeItem({ status: 'FAILED', failCode: 'CORRUPT' }), true)).toEqual({
      phase: 'failed',
      failCode: 'CORRUPT',
    })
    expect(phaseOf(fakeItem({ status: 'UPLOADING' }), false)).toEqual({ phase: 'abandoned' })
    expect(phaseOf(fakeItem({ status: 'UPLOADING' }), true)).toEqual({ phase: 'uploading' })
    expect(phaseOf(fakeItem({ status: 'DELETED' }), true)).toEqual({ phase: 'gone' })
  })
})

describe('failReasonKey', () => {
  it('knows the server codes and falls back for anything else', () => {
    expect(failReasonKey('UNSUPPORTED_FORMAT')).toBe('UNSUPPORTED_FORMAT')
    expect(failReasonKey('UPLOAD_ABANDONED')).toBe('UPLOAD_ABANDONED')
    expect(failReasonKey('SOMETHING_NEW')).toBe('PROCESSING_FAILED')
    expect(failReasonKey(null)).toBe('PROCESSING_FAILED')
  })
})

describe('polling', () => {
  it('polls every 3 seconds while anything is still being made, otherwise stops', () => {
    expect(pollInterval([fakeItem({ status: 'QUEUED' })])).toBe(3000)
    expect(pollInterval([fakeItem({ compat: 'RUNNING' })])).toBe(3000)
    expect(pollInterval([fakeItem({ ladder: 'QUEUED' })])).toBe(3000)
    expect(pollInterval([fakeItem(), fakeItem({ status: 'FAILED', failCode: 'CORRUPT' })])).toBe(
      false,
    )
    expect(pollInterval(undefined)).toBe(false)
    expect(pollInterval([fakeItem({ status: 'QUEUED' })], 100)).toBe(100)
  })

  it('does not poll a plain upload in progress - the browser is the one talking', () => {
    expect(isBusy(fakeItem({ status: 'UPLOADING' }))).toBe(false)
  })
})

describe('formatDuration', () => {
  it('writes m:ss and h:mm:ss', () => {
    expect(formatDuration(42_000)).toBe('0:42')
    expect(formatDuration(83_400)).toBe('1:23')
    expect(formatDuration(3_723_000)).toBe('1:02:03')
  })
})
