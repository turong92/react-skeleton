import { boardKeys } from '@skeleton/board'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { refreshAfterProfileChange } from './profileCache'
import { myProfileKey } from './useMyProfile'

describe('refreshAfterProfileChange', () => {
  it('re-reads my profile and everything on the board that shows author names', () => {
    const client = new QueryClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    refreshAfterProfileChange(client)
    const keys = invalidate.mock.calls.map((call) => JSON.stringify(call[0]?.queryKey))
    expect(keys).toEqual([JSON.stringify(myProfileKey), JSON.stringify(boardKeys.all)])
  })
})
