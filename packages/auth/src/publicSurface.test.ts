import { describe, expect, it } from 'vitest'
import * as auth from './index'

describe('the public surface', () => {
  it('does not export loginIdServerCode - only the stories fake and tests use it, and its Size-before-Pattern order is not the server’s', () => {
    expect(Object.keys(auth)).not.toContain('loginIdServerCode')
  })
})
