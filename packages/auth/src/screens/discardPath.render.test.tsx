import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DiscardPath } from './DiscardPath'
import { koAuthLabels } from './labels.ko'

const out = (loginId?: string) =>
  renderToStaticMarkup(
    <DiscardPath
      labels={koAuthLabels}
      providers={['kakao']}
      discard={async () => undefined}
      onDiscarded={() => undefined}
      loginId={loginId}
    />,
  )

describe('DiscardPath confirmation', () => {
  it('has no login id line when the account has no login id (the login id gate, or a server without it)', () => {
    expect(out()).not.toContain('다시 쓸 수 없어요')
  })

  it('names the login id and says it can never be used again, when the account has one', () => {
    expect(out('sumin.kim')).toContain('아이디 sumin.kim 도 함께 사라지고 다시 쓸 수 없어요.')
  })
})
