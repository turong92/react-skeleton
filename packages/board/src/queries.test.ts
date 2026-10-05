import { describe, expect, it } from 'vitest'
import { boardKeys, commentListQuery, configQuery, postListQuery, postQuery } from './queries'
import { stubApi } from './test/fixtures'

describe('boardKeys — one root, nested, so invalidation and cache patches work by prefix', () => {
  it('nests: all ⊃ posts(code) ⊃ postLists(code) ⊃ postList(code, params)', () => {
    expect(boardKeys.all).toEqual(['board'])
    expect(boardKeys.posts('free')).toEqual(['board', 'posts', 'free'])
    expect(boardKeys.postLists('free')).toEqual(['board', 'posts', 'free', 'list'])
    expect(boardKeys.postList('free', { page: 1 })).toEqual([
      'board',
      'posts',
      'free',
      'list',
      { page: 1 },
    ])
    expect(boardKeys.post('free', 1)).toEqual(['board', 'posts', 'free', 'detail', 1])
  })

  it('comments are keyed by board and post, then by their list params', () => {
    expect(boardKeys.comments('free', 1)).toEqual(['board', 'comments', 'free', 1])
    expect(boardKeys.commentList('free', 1, { sort: 'latest' })).toEqual([
      'board',
      'comments',
      'free',
      1,
      { sort: 'latest' },
    ])
  })

  it('the config and the board list have their own keys', () => {
    expect(boardKeys.config()).toEqual(['board', 'config'])
    expect(boardKeys.boards()).toEqual(['board', 'boards'])
  })
})

describe('query definitions — a key plus the call, apart from the hooks', () => {
  it('each asks the api for exactly its parameters', async () => {
    const calls: unknown[][] = []
    const api = stubApi({
      getConfig: async () => (calls.push(['config']), {} as never),
      listPosts: async (...args) => (calls.push(['posts', ...args]), {} as never),
      getPost: async (...args) => (calls.push(['post', ...args]), {} as never),
      listComments: async (...args) => (calls.push(['comments', ...args]), {} as never),
    })
    await configQuery(api).queryFn()
    await postListQuery(api, 'free', { page: 1 }).queryFn()
    await postQuery(api, 'free', 1).queryFn()
    await commentListQuery(api, 'free', 1, { sort: 'latest' }).queryFn()
    expect(calls).toEqual([
      ['config'],
      ['posts', 'free', { page: 1 }],
      ['post', 'free', 1],
      ['comments', 'free', 1, { sort: 'latest' }],
    ])
  })
})
