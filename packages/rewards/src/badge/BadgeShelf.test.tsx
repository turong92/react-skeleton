import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koRewardsLabels } from '../labels'
import { BadgeTile } from './BadgeTile'
import { ProfileBadges } from './ProfileBadges'
import type { BadgeApi } from './badgeApi'

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
  it('draws nothing while there is nothing to show (no empty box on a profile)', () => {
    const api: Pick<BadgeApi, 'profileBadges'> = { profileBadges: async () => [] }
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <ProfileBadges api={api} accountId="a1" labels={koRewardsLabels} />
      </QueryClientProvider>,
    )
    expect(html).toBe('')
  })
})
