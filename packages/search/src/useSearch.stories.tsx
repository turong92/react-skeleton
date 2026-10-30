import type { Meta, StoryObj } from '@storybook/react-vite'
import { Input } from '@skeleton/ui'
import { useState } from 'react'
import { expect, waitFor } from 'storybook/test'
import { useSearch } from './queries'
import { createFakeSearch } from './stories/fakeSearch'
import { WithQuery } from './stories/WithQuery'

/**
 * `useSearch` - 입력이 멈출 때까지 늦추고(기본 300ms) 그 값으로만 묻는다. 2글자 미만이면 묻지 않는다. 새 조건을 가져오는 동안 앞 쪽이 남는다.
 * 키를 누를 때마다 서버에 가지 않는다는 것을 이 스토리가 보인다.
 */
const fake = createFakeSearch()
function Live() {
  const [q, setQ] = useState('')
  const { query, searchable, settling } = useSearch(fake.api, { q }, { delayMs: 150 })
  return (
    <div>
      <Input type="search" aria-label="live" value={q} onChange={(e) => setQ(e.target.value)} />
      <p data-testid="state">
        {searchable ? 'searchable' : 'short'} {settling ? 'settling' : 'settled'}{' '}
        {query.data?.pagination.totalElements ?? '-'}
      </p>
    </div>
  )
}

const meta = {
  title: 'Packages/search/useSearch',
  component: Live,
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof Live>
export default meta
type Story = StoryObj<typeof meta>

export const AsksOnceAfterTypingStops: Story = {
  play: async ({ canvas, userEvent }) => {
    fake.calls.length = 0
    await userEvent.type(canvas.getByRole('searchbox', { name: 'live' }), '가방끈')
    await expect(canvas.getByTestId('state')).toHaveTextContent('settling')
    await waitFor(() =>
      expect(canvas.getByTestId('state')).toHaveTextContent('searchable settled 1'),
    )
    await expect(fake.calls.map((c) => c.q)).toEqual(['가방끈'])
  },
}

export const ShortInputDoesNotAsk: Story = {
  play: async ({ canvas, userEvent }) => {
    fake.calls.length = 0
    await userEvent.type(canvas.getByRole('searchbox', { name: 'live' }), '가')
    await waitFor(() => expect(canvas.getByTestId('state')).toHaveTextContent('short settled'))
    await expect(fake.calls).toHaveLength(0)
  },
}
