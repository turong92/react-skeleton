import { QueryClient } from '@tanstack/react-query'
import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { refreshProfilesOnAuthorRefusal } from './authorRefusal'
import { authorProfileKeys } from './queries'
import { profile } from './test/fixtures'

const refusal = (code: string) =>
  new ApiRequestError({ code, title: 't', status: 403, timestamp: 'now' }, 't', 's', 'tp')

describe('refreshProfilesOnAuthorRefusal — the board refused the author id (a profile deleted in another tab): the picker must not keep drawing the stale list', () => {
  const setup = () => {
    const client = new QueryClient()
    client.setQueryData(authorProfileKeys.list(), [profile('prf_a', 'Ann')])
    return client
  }
  const stale = (client: QueryClient) =>
    client.getQueryState(authorProfileKeys.list())?.isInvalidated === true

  it('BOARD.AUTHOR_NOT_ALLOWED marks the profile list stale and says it handled it', () => {
    const client = setup()
    expect(
      refreshProfilesOnAuthorRefusal(client, refusal(ErrorCodes.BOARD_AUTHOR_NOT_ALLOWED)),
    ).toBe(true)
    expect(stale(client)).toBe(true)
  })

  it('any other error leaves the list alone', () => {
    const client = setup()
    expect(refreshProfilesOnAuthorRefusal(client, refusal(ErrorCodes.BOARD_FORBIDDEN))).toBe(false)
    expect(refreshProfilesOnAuthorRefusal(client, new Error('x'))).toBe(false)
    expect(stale(client)).toBe(false)
  })
})
