import { describe, expect, it } from 'vitest'
import { redactHeaders, redactSensitiveData } from './workbenchUtils'

describe('workbenchUtils', () => {
  it('redacts authorization headers regardless of casing', () => {
    expect(
      redactHeaders({
        authorization: 'Bearer secret-token',
        Authorization: 'Basic user:password',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      }),
    ).toEqual({
      authorization: 'Bearer ...',
      Authorization: '[REDACTED]',
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    })
  })

  it('redacts sensitive request and response fields recursively', () => {
    expect(
      redactSensitiveData({
        request: {
          body: {
            email: 'user@example.com',
            password: 'password',
          },
        },
        response: {
          value: {
            accessToken: 'jwt-token',
            principal: {
              accountId: 'acc_user',
            },
          },
        },
      }),
    ).toEqual({
      request: {
        body: {
          email: 'user@example.com',
          password: '[REDACTED]',
        },
      },
      response: {
        value: {
          accessToken: '[REDACTED]',
          principal: {
            accountId: 'acc_user',
          },
        },
      },
    })
  })
})
