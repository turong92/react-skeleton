import { describe, expect, it } from 'vitest'
import { emptyQueue, reduceQueue, type QueueItem } from './playQueue'
import {
  loadQueue,
  loadVolume,
  parseQueue,
  saveQueue,
  saveVolume,
  serializeQueue,
  type QueueStorage,
} from './queueStorage'

function memory(
  initial: Record<string, string> = {},
): QueueStorage & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => void (data[k] = v),
    removeItem: (k) => void delete data[k],
  }
}

const items: QueueItem[] = [
  {
    kind: 'media',
    id: 'a',
    title: 'A',
    artist: 'X',
    source: { src: '/a.m3u8', audio: '/a-audio.m3u8' },
  },
  { kind: 'youtube', id: 'y', title: 'Y', videoId: 'abc123' },
]
const sample = () => {
  let s = reduceQueue(emptyQueue, { type: 'set', items, startId: 'y' })
  s = reduceQueue(s, { type: 'repeat', repeat: 'all' })
  return reduceQueue(s, { type: 'shuffle', on: true, random: () => 0 })
}

describe('queue storage', () => {
  it('restores what was saved - list, current song, repeat and shuffle', () => {
    const storage = memory()
    saveQueue(storage, 'k', sample())
    expect(loadQueue(storage, 'k')).toEqual(sample())
  })

  it('uses the key the app chose', () => {
    const storage = memory()
    saveQueue(storage, 'my-app.queue', sample())
    expect(Object.keys(storage.data)).toEqual(['my-app.queue'])
  })

  it('removes the key when the list is empty', () => {
    const storage = memory({ k: serializeQueue(sample()) })
    saveQueue(storage, 'k', emptyQueue)
    expect(storage.data).toEqual({})
  })

  it('starts empty when nothing, garbage or an old shape is stored', () => {
    expect(parseQueue(null)).toEqual(emptyQueue)
    expect(parseQueue('not json')).toEqual(emptyQueue)
    expect(parseQueue(JSON.stringify({ v: 0, items: [] }))).toEqual(emptyQueue)
  })

  it('drops items of an unknown shape and ids that point at nothing', () => {
    const text = JSON.stringify({
      v: 1,
      items: [items[0], { kind: 'media', id: 'broken' }, { kind: 'ftp', id: 'q', title: 'Q' }],
      order: ['a', 'ghost'],
      original: ['ghost', 'a'],
      currentId: 'ghost',
      repeat: 'sideways',
      shuffle: 'yes',
    })
    const s = parseQueue(text)
    expect(s.order).toEqual(['a'])
    expect(s.original).toEqual(['a'])
    expect(s.currentId).toBe('a')
    expect(s.repeat).toBe('off')
    expect(s.shuffle).toBe(false)
  })

  it('keeps playing when storage refuses to write', () => {
    const storage: QueueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceeded')
      },
      removeItem: () => {},
    }
    expect(() => saveQueue(storage, 'k', sample())).not.toThrow()
  })

  it('loads nothing when there is no storage at all', () => {
    expect(loadQueue(undefined, 'k')).toEqual(emptyQueue)
  })
})

describe('queue storage - hand-edited order lists', () => {
  it('drops an id that is listed twice, so a song is never in the list twice', () => {
    const text = JSON.stringify({
      v: 1,
      items: [items[0], items[1]],
      order: ['a', 'y', 'a'],
      original: ['y', 'y', 'a'],
      currentId: 'a',
      repeat: 'off',
      shuffle: false,
    })
    const s = parseQueue(text)
    expect(s.order).toEqual(['a', 'y'])
    expect(s.original).toEqual(['y', 'a'])
  })
})

describe('volume storage', () => {
  it('keeps volume and muted under their own key, so an emptied queue still remembers them', () => {
    const storage = memory()
    saveVolume(storage, 'q', { volume: 0.4, muted: true })
    expect(loadVolume(storage, 'q')).toEqual({ volume: 0.4, muted: true })
    expect(Object.keys(storage.data)).toEqual(['q.volume'])
  })

  it('reads the defaults (full volume, not muted) when nothing or something broken is stored', () => {
    expect(loadVolume(memory(), 'q')).toEqual({ volume: 1, muted: false })
    expect(loadVolume(memory({ 'q.volume': 'nope' }), 'q')).toEqual({ volume: 1, muted: false })
    expect(loadVolume(memory({ 'q.volume': '{"volume":7,"muted":"x"}' }), 'q')).toEqual({
      volume: 1,
      muted: false,
    })
  })

  it('leaves a queue saved before volume existed readable as it was', () => {
    const storage = memory({ q: serializeQueue(sample()) })
    expect(loadQueue(storage, 'q').currentId).toBe('y')
    expect(loadVolume(storage, 'q')).toEqual({ volume: 1, muted: false })
  })
})
