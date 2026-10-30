import { describe, expect, it } from 'vitest'
import { MAX_INVITE_EMAILS, parseInviteEmails, seatUsage } from './inviteInput'

describe('parseInviteEmails — what the textarea means', () => {
  it('splits on commas, semicolons, spaces and newlines, lowercases, and drops duplicates', () => {
    expect(
      parseInviteEmails('Ann@Example.com, bo@example.com;\n  ann@example.com  cy@example.com\n\n'),
    ).toEqual({
      emails: ['ann@example.com', 'bo@example.com', 'cy@example.com'],
      invalid: [],
      tooMany: false,
    })
  })
  it('keeps the malformed ones apart so the screen can name them', () => {
    const result = parseInviteEmails('ann@example.com nope @example.com a@b')
    expect(result.emails).toEqual(['ann@example.com'])
    expect(result.invalid).toEqual(['nope', '@example.com', 'a@b'])
  })
  it('an address longer than 254 characters is malformed (the server column)', () => {
    const long = `${'a'.repeat(250)}@example.com`
    expect(parseInviteEmails(long).invalid).toEqual([long])
  })
  it('empty text is nothing, not an error', () => {
    expect(parseInviteEmails('  \n ')).toEqual({ emails: [], invalid: [], tooMany: false })
  })
  it('more than 20 valid addresses at once is flagged (the server takes 20 per request)', () => {
    const many = Array.from({ length: MAX_INVITE_EMAILS + 1 }, (_, i) => `u${i}@example.com`)
    expect(parseInviteEmails(many.join('\n')).tooMany).toBe(true)
    expect(parseInviteEmails(many.slice(0, MAX_INVITE_EMAILS).join('\n')).tooMany).toBe(false)
    expect(MAX_INVITE_EMAILS).toBe(20)
  })
})

describe('seatUsage — members plus live invitations against the limit', () => {
  it('is null when the app set no limit', () => {
    expect(seatUsage({ memberCount: 3, pendingInvitations: 1, seatLimit: null })).toBeNull()
    expect(seatUsage({ memberCount: 3, pendingInvitations: 1 })).toBeNull()
  })
  it('counts members + pending against the limit and says when it is full', () => {
    expect(seatUsage({ memberCount: 2, pendingInvitations: 1, seatLimit: 5 })).toEqual({
      used: 3,
      limit: 5,
      left: 2,
      full: false,
    })
    expect(seatUsage({ memberCount: 3, pendingInvitations: 2, seatLimit: 5 })).toMatchObject({
      left: 0,
      full: true,
    })
    expect(seatUsage({ memberCount: 6, pendingInvitations: 0, seatLimit: 5 })).toMatchObject({
      left: 0,
      full: true,
    })
  })
})
