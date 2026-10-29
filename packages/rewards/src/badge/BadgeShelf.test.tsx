import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koRewardsLabels } from '../labels'
import { BadgeTile } from './BadgeTile'
import { ProfileBadges } from './ProfileBadges'
import type { BadgeApi } from './badgeApi'
import { badgeKeys } from './queries'
import type { PublicBadge } from './types'

describe('BadgeTile', () => {
  it('draws the first letter in a circle when there is no picture address', () => {
    const html = renderToStaticMarkup(
      <BadgeTile state="earned" name="얼리 버드" labels={koRewardsLabels} imageUrl={null} />,
    )
    expect(html).not.toContain('<img')
    expect(html).toContain('>얼<')
  })

  it('draws the picture from the address when there is one, and lets the app replace it', () => {
    const plain = renderToStaticMarkup(
      <BadgeTile
        state="earned"
        name="Early"
        labels={koRewardsLabels}
        imageUrl="https://example.com/a.png"
      />,
    )
    expect(plain).toContain('src="https://example.com/a.png"')
    const custom = renderToStaticMarkup(
      <BadgeTile
        state="earned"
        name="Early"
        labels={koRewardsLabels}
        imageUrl="https://example.com/a.png"
        renderImage={(src) => <i data-custom={src} />}
      />,
    )
    expect(custom).toContain('data-custom="https://example.com/a.png"')
    expect(custom).not.toContain('<img')
  })

  it('shows a hidden locked badge as a question mark with no name, description or picture', () => {
    const html = renderToStaticMarkup(
      <BadgeTile
        state="hidden"
        name={null}
        description={null}
        imageUrl={null}
        labels={koRewardsLabels}
      />,
    )
    expect(html).toContain('>?<')
    expect(html).toContain(koRewardsLabels.badge.hiddenName)
    expect(html).not.toContain('<img')
  })
})

describe('ProfileBadges', () => {
  const api: Pick<BadgeApi, 'profileBadges'> = { profileBadges: async () => [] }
  const html = (badges: PublicBadge[]) => {
    const client = new QueryClient()
    client.setQueryData(badgeKeys.profile('a1'), badges)
    return renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <ProfileBadges api={api} accountId="a1" labels={koRewardsLabels} />
      </QueryClientProvider>,
    )
  }

  it('draws nothing when the account has no public badge (no empty box on a profile)', () => {
    expect(html([])).toBe('')
  })

  it('draws each badge by name and keeps the description readable for a screen reader, not only as a hover title', () => {
    const out = html([
      { code: 'early', name: '얼리 버드', description: '초기에 함께했어요', imageUrl: null },
    ])
    expect(out).toContain('얼리 버드')
    expect(out).toContain('초기에 함께했어요')
    expect(out).not.toContain('title=')
  })
})
