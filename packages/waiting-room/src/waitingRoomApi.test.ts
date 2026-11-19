import { describe, expect, it } from 'vitest'
import { createEntryHeaders } from './entryHeaders'
import { createWaitingRoomApi } from './waitingRoomApi'
import { recordingClient } from './test/recordingClient'

describe('createWaitingRoomApi', () => {
  it('takes a ticket with POST /waiting-rooms/{id}/tickets', async () => {
    const { client, calls } = recordingClient({ state: 'WAITING', ticket: 'tk' })
    const ticket = await createWaitingRoomApi(client).takeTicket('wr_1')
    expect(ticket).toEqual({ state: 'WAITING', ticket: 'tk' })
    expect(calls).toEqual([
      { kind: 'value', path: '/waiting-rooms/wr_1/tickets', request: { method: 'POST' } },
    ])
  })

  it('asks the status with the ticket in X-Ticket', async () => {
    const { client, calls } = recordingClient({ state: 'WAITING' })
    await createWaitingRoomApi(client).status('wr_1', 'tk')
    expect(calls).toEqual([
      {
        kind: 'value',
        path: '/waiting-rooms/wr_1/status',
        request: { headers: { 'X-Ticket': 'tk' } },
      },
    ])
  })

  it('honours a different base path and escapes the room id', async () => {
    const { client, calls } = recordingClient()
    await createWaitingRoomApi(client, { basePath: '/queues/' }).takeTicket('a/b')
    expect(calls[0].path).toBe('/queues/a%2Fb/tickets')
  })
})

describe('createEntryHeaders', () => {
  it('puts the entry token in X-Entry-Token, and sends nothing without one', () => {
    expect(createEntryHeaders('en')).toEqual({ 'X-Entry-Token': 'en' })
    expect(createEntryHeaders(null)).toEqual({})
  })
})
