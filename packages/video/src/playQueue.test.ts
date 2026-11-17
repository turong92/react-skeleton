import { describe, expect, it } from 'vitest'
import {
  currentOf,
  emptyQueue,
  nextPlayableId,
  previousPlayableId,
  reduceQueue,
  shuffled,
  upcomingOf,
  type QueueAction,
  type QueueItem,
  type QueueState,
} from './playQueue'

const media = (id: string, audio?: string): QueueItem => ({
  kind: 'media',
  id,
  title: `Song ${id}`,
  source: { src: `/m/${id}/index.m3u8`, audio },
})
const youtube = (id: string): QueueItem => ({ kind: 'youtube', id, title: `YT ${id}`, videoId: id })

const run = (actions: QueueAction[], from: QueueState = emptyQueue) =>
  actions.reduce(reduceQueue, from)
const abc = () => run([{ type: 'set', items: [media('a'), media('b'), media('c')] }])
/** 항상 같은 값을 돌려주는 난수 - 섞는 결과가 정해져 있다(맨 앞 제외 뒤집힘) */
const fixed = () => 0

describe('reduceQueue - building the list', () => {
  it('starts at the first song, or at the one asked for', () => {
    expect(abc().currentId).toBe('a')
    const s = run([{ type: 'set', items: [media('a'), media('b')], startId: 'b' }])
    expect(s.currentId).toBe('b')
    expect(s.order).toEqual(['a', 'b'])
  })

  it('keeps only the first of a repeated id', () => {
    const s = run([{ type: 'set', items: [media('a'), { ...media('a'), title: 'dup' }] }])
    expect(s.order).toEqual(['a'])
    expect(currentOf(s)?.title).toBe('Song a')
  })

  it('lists what comes after the current song as the up-next list', () => {
    const s = run([{ type: 'current', id: 'b' }], abc())
    expect(upcomingOf(s).map((i) => i.id)).toEqual(['c'])
  })

  it('adds to the end, or right after the current song', () => {
    let s = run([{ type: 'add', item: media('d'), where: 'end' }], abc())
    expect(s.order).toEqual(['a', 'b', 'c', 'd'])
    s = run([{ type: 'add', item: media('e'), where: 'next' }], s)
    expect(s.order).toEqual(['a', 'e', 'b', 'c', 'd'])
    expect(s.original).toEqual(['a', 'e', 'b', 'c', 'd'])
  })

  it('moves a song already in the list instead of doubling it', () => {
    const s = run([{ type: 'add', item: media('c'), where: 'next' }], abc())
    expect(s.order).toEqual(['a', 'c', 'b'])
  })

  it('the first song added to an empty list becomes the current one', () => {
    const s = run([{ type: 'add', item: media('a'), where: 'end' }])
    expect(s.currentId).toBe('a')
  })

  it('removes a song, and moves on to the following one when it was the current', () => {
    let s = run([{ type: 'remove', id: 'b' }], abc())
    expect(s.order).toEqual(['a', 'c'])
    expect(s.currentId).toBe('a')
    s = run([{ type: 'remove', id: 'a' }], abc())
    expect(s.currentId).toBe('b')
    s = run(
      [
        { type: 'current', id: 'c' },
        { type: 'remove', id: 'c' },
      ],
      abc(),
    )
    expect(s.currentId).toBe('b')
    s = run(
      [
        { type: 'remove', id: 'a' },
        { type: 'remove', id: 'b' },
        { type: 'remove', id: 'c' },
      ],
      abc(),
    )
    expect(s.currentId).toBeNull()
  })

  it('reorders the up-next list', () => {
    const s = run([{ type: 'move', id: 'c', to: 1 }], abc())
    expect(s.order).toEqual(['a', 'c', 'b'])
    expect(s.original).toEqual(['a', 'c', 'b'])
  })
})

describe('reduceQueue - shuffle', () => {
  it('keeps the current song first and can go back to the original order', () => {
    let s = run(
      [
        { type: 'current', id: 'b' },
        { type: 'shuffle', on: true, random: fixed },
      ],
      abc(),
    )
    expect(s.order[0]).toBe('b')
    expect([...s.order].sort()).toEqual(['a', 'b', 'c'])
    expect(s.original).toEqual(['a', 'b', 'c'])
    s = run([{ type: 'shuffle', on: false }], s)
    expect(s.order).toEqual(['a', 'b', 'c'])
    expect(s.currentId).toBe('b')
  })

  it('a reorder while shuffled does not change the original order', () => {
    const s = run(
      [
        { type: 'shuffle', on: true, random: fixed },
        { type: 'move', id: 'a', to: 0 },
      ],
      abc(),
    )
    expect(s.original).toEqual(['a', 'b', 'c'])
  })

  it('a list set while shuffled comes out shuffled with the start song first', () => {
    const s = run([
      { type: 'shuffle', on: true },
      { type: 'set', items: [media('a'), media('b'), media('c')], startId: 'c', random: fixed },
    ])
    expect(s.order[0]).toBe('c')
  })

  it('shuffled() leaves nobody out', () => {
    expect([...shuffled(['a', 'b', 'c', 'd'], 'c', Math.random)].sort()).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
  })
})

describe('nextPlayableId', () => {
  const all = () => true

  it('goes to the next song, and stops at the end when repeat is off', () => {
    const s = run([{ type: 'current', id: 'b' }], abc())
    expect(nextPlayableId(s, all, true)).toBe('c')
    const end = run([{ type: 'current', id: 'c' }], abc())
    expect(nextPlayableId(end, all, true)).toBeNull()
  })

  it('wraps to the start with repeat all', () => {
    const s = run(
      [
        { type: 'current', id: 'c' },
        { type: 'repeat', repeat: 'all' },
      ],
      abc(),
    )
    expect(nextPlayableId(s, all, true)).toBe('a')
  })

  it('repeats the same song on its own with repeat one, but the next button still moves on', () => {
    const s = run([{ type: 'repeat', repeat: 'one' }], abc())
    expect(nextPlayableId(s, all, true)).toBe('a')
    expect(nextPlayableId(s, all, false)).toBe('b')
  })

  it('skips what cannot be played right now', () => {
    const s = run([{ type: 'set', items: [media('a', 'x'), youtube('y'), media('c', 'x')] }])
    expect(nextPlayableId(s, (i) => i.kind === 'media', true)).toBe('c')
  })

  it('returns nothing when everything else must be skipped (no endless loop)', () => {
    const s = run([
      { type: 'set', items: [youtube('x'), youtube('y'), youtube('z')] },
      { type: 'repeat', repeat: 'all' },
    ])
    expect(nextPlayableId(s, () => false, true)).toBeNull()
  })

  it('with repeat all and only the current song playable, plays it again', () => {
    const s = run([
      { type: 'set', items: [media('a', 'x'), youtube('y')] },
      { type: 'repeat', repeat: 'all' },
    ])
    expect(nextPlayableId(s, (i) => i.kind === 'media', true)).toBe('a')
  })
})

describe('previousPlayableId', () => {
  const all = () => true

  it('restarts the song when it has played more than 3 seconds', () => {
    const s = run([{ type: 'current', id: 'b' }], abc())
    expect(previousPlayableId(s, all, 10)).toEqual({ id: 'b', restart: true })
  })

  it('goes to the song before it otherwise', () => {
    const s = run([{ type: 'current', id: 'b' }], abc())
    expect(previousPlayableId(s, all, 1)).toEqual({ id: 'a', restart: false })
  })

  it('restarts at the very first song, and wraps with repeat all', () => {
    expect(previousPlayableId(abc(), all, 0)).toEqual({ id: 'a', restart: true })
    const s = run([{ type: 'repeat', repeat: 'all' }], abc())
    expect(previousPlayableId(s, all, 0)).toEqual({ id: 'c', restart: false })
  })

  it('has nothing to go back to in an empty list', () => {
    expect(previousPlayableId(emptyQueue, all, 0)).toBeNull()
  })
})

describe('retitle', () => {
  it('changes only the title and artist of a queued item, keeping order and the current item', () => {
    const a = {
      kind: 'media' as const,
      id: 'a',
      title: 'A',
      artist: 'x',
      source: { src: '/a.m3u8' },
    }
    const b = { kind: 'media' as const, id: 'b', title: 'B', source: { src: '/b.m3u8' } }
    let q = reduceQueue(emptyQueue, { type: 'set', items: [a, b], startId: 'b' })
    q = reduceQueue(q, { type: 'retitle', id: 'a', title: 'New', artist: undefined })
    expect(q.items.a).toEqual({ kind: 'media', id: 'a', title: 'New', source: { src: '/a.m3u8' } })
    expect(q.order).toEqual(['a', 'b'])
    expect(q.currentId).toBe('b')
    expect(reduceQueue(q, { type: 'retitle', id: 'zz', title: 'n' })).toBe(q)
  })
})

describe('update', () => {
  it('swaps in the new content of a queued item (e.g. a sound file that arrived later), keeping order and the current item', () => {
    const y = { kind: 'youtube' as const, id: 'y', title: 'Y', videoId: 'v' }
    const b = { kind: 'media' as const, id: 'b', title: 'B', source: { src: '/b.m3u8' } }
    let q = reduceQueue(emptyQueue, { type: 'set', items: [y, b], startId: 'y' })
    q = reduceQueue(q, { type: 'update', item: { ...y, audio: '/media/y/audio.m4a' } })
    expect(q.items.y).toEqual({ ...y, audio: '/media/y/audio.m4a' })
    expect(q.order).toEqual(['y', 'b'])
    expect(q.currentId).toBe('y')
    expect(reduceQueue(q, { type: 'update', item: { ...b, id: 'zz' } })).toBe(q)
  })
})
