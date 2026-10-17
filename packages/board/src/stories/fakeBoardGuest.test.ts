import { ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createFakeBoard } from './fakeBoard'

describe('the fake board behaves like the server for guests', () => {
  const setup = () =>
    createFakeBoard({
      seed: false,
      anonymous: true,
      guestWrite: 'ALL',
      commentApproval: 'GUESTS',
      ownerModerates: true,
    })

  it('a guest comment is waiting, invisible to the public, and only its secret edits it', async () => {
    const board = setup()
    const post = board.newPost('Hello', 'World', 'alice')
    const made = await board.api.createComment('free', post.id, {
      body: 'Nice',
      guest: { name: 'Visitor', secret: 'pw-1234' },
    })
    expect(made).toMatchObject({
      status: 'PENDING',
      authorGuest: true,
      authorName: 'Visitor',
      body: 'Nice',
    })
    expect((await board.api.listComments('free', post.id)).values).toEqual([])
    await expect(
      board.api.updateComment('free', post.id, made.id, { body: 'x' }, { guestSecret: 'wrong' }),
    ).rejects.toSatisfy((e) => isErrorCode(e, ErrorCodes.BOARD_FORBIDDEN))
    await expect(
      board.api.updateComment(
        'free',
        post.id,
        made.id,
        { body: 'Nicer' },
        { guestSecret: 'pw-1234' },
      ),
    ).resolves.toMatchObject({ body: 'Nicer' })
  })

  it('guests need the captcha token when required, and a board that closes guests answers 401', async () => {
    const strict = createFakeBoard({
      seed: false,
      anonymous: true,
      guestWrite: 'ALL',
      captchaRequired: true,
    })
    const post = strict.newPost('Hello', 'World', 'alice')
    await expect(
      strict.api.createComment('free', post.id, {
        body: 'x',
        guest: { name: 'V', secret: 'pw-1234' },
      }),
    ).rejects.toSatisfy((e) => isErrorCode(e, ErrorCodes.BOARD_CAPTCHA_FAILED))
    const closed = createFakeBoard({ seed: false, anonymous: true })
    const p = closed.newPost('Hello', 'World', 'alice')
    await expect(
      closed.api.createComment('free', p.id, {
        body: 'x',
        guest: { name: 'V', secret: 'pw-1234' },
      }),
    ).rejects.toSatisfy((e) => isErrorCode(e, 'COMMON.UNAUTHORIZED'))
  })
})
