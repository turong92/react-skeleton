import { describe, expect, it } from 'vitest'
import { createInquiryApi } from './inquiryApi'
import { recordingClient } from './test/recordingClient'

describe('createInquiryApi', () => {
  it('posts the trimmed question to /inquiries and returns the receipt', async () => {
    const { client, calls } = recordingClient({ status: 'RECEIVED' })
    const receipt = await createInquiryApi(client).send({
      kind: 'QUESTION',
      body: '  노트를 내려받는 방법이 궁금해요  ',
      lang: 'ko',
    })
    expect(receipt).toEqual({ status: 'RECEIVED' })
    expect(calls).toEqual([
      {
        kind: 'value',
        path: '/inquiries',
        request: {
          method: 'POST',
          json: { kind: 'QUESTION', body: '노트를 내려받는 방법이 궁금해요', lang: 'ko' },
        },
      },
    ])
  })

  it('leaves blank optional fields out and sends the filled ones', () => {
    const { client, calls } = recordingClient()
    void createInquiryApi(client).send({
      kind: 'BUG',
      body: 'a'.repeat(10),
      replyEmail: '   ',
      context: '',
      captchaToken: null,
    })
    void createInquiryApi(client).send({
      kind: 'FEATURE',
      body: 'b'.repeat(10),
      replyEmail: ' me@example.com ',
      context: 'screen:notes',
      captchaToken: 'tok',
    })
    expect(calls[0].request).toEqual({
      method: 'POST',
      json: { kind: 'BUG', body: 'a'.repeat(10) },
    })
    expect(calls[1].request).toEqual({
      method: 'POST',
      json: {
        kind: 'FEATURE',
        body: 'b'.repeat(10),
        replyEmail: 'me@example.com',
        context: 'screen:notes',
        captchaToken: 'tok',
      },
    })
  })

  it('honours a different base path', () => {
    const { client, calls } = recordingClient()
    void createInquiryApi(client, { basePath: '/support/' }).send({
      kind: 'OTHER',
      body: 'c'.repeat(10),
    })
    expect(calls[0].path).toBe('/support')
  })
})
