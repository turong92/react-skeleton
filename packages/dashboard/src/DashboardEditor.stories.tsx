import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, waitFor, within } from 'storybook/test'
import { DashboardView } from './DashboardView'
import { createFakeDashboardApi, type FakeDashboardOptions } from './stories/fakeDashboard'

/**
 * 편집 모드 - 「편집」 → 타일 · 카드를 스위치로 끄고, 카드는 ▲▼(또는 끌어서)로 순서를 바꾸고, 「완료」로 저장한다.
 * 저장은 서버(`GET/PUT layout`, 계정별)에, 서버에 저장소가 없으면(404 `DASHBOARD.LAYOUT_UNAVAILABLE`) 브라우저에 둔다(`layoutKey` 가 키에 들어간다).
 * 여기서는 「다시 열기」 단추가 화면을 새로 마운트한다 - 저장된 배치가 돌아오는지 본다.
 */
function Reopenable({ options }: { options?: FakeDashboardOptions }) {
  const [{ api }] = useState(() => createFakeDashboardApi(options))
  const [layoutKey] = useState(() => `story-${Math.random().toString(36).slice(2)}`)
  const [opened, setOpened] = useState(0)
  return (
    <>
      <button type="button" onClick={() => setOpened((n) => n + 1)}>
        Reload page
      </button>
      <Fresh key={opened}>
        <DashboardView api={api} zone="Asia/Seoul" locale="en-US" layoutKey={layoutKey} />
      </Fresh>
    </>
  )
}

function Fresh({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const meta = {
  title: 'Packages/dashboard/DashboardEditor',
  component: Reopenable,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Reopenable>
export default meta
type Story = StoryObj<typeof meta>

const cardNames = (root: HTMLElement) =>
  within(root)
    .getAllByRole('article')
    .map((card) => card.getAttribute('aria-label'))

async function editAndSave(
  canvas: ReturnType<typeof within>,
  userEvent: { click: (e: Element) => Promise<void> },
) {
  await userEvent.click(await canvas.findByRole('button', { name: 'Edit' }))
  await userEvent.click(canvas.getByRole('switch', { name: 'Show Funnel' }))
  await userEvent.click(canvas.getByRole('switch', { name: 'Show Pageviews' }))
  await userEvent.click(canvas.getByRole('button', { name: 'Move Pages earlier' }))
  await userEvent.click(canvas.getByRole('button', { name: 'Done' }))
  await waitFor(() =>
    expect(canvas.getByRole('button', { name: 'Edit' })).toHaveAttribute('aria-pressed', 'false'),
  )
}

export const TurnOffAndMoveThenReopen: Story = {
  render: () => <Reopenable />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await canvas.findByRole('heading', { name: 'Visits over time' })
    await expect(cardNames(canvasElement)).toEqual([
      'Traffic',
      'Pages',
      'Places and devices',
      'Funnel',
      'App stats',
    ])
    await editAndSave(canvas, userEvent)
    await expect(cardNames(canvasElement)).toEqual([
      'Pages',
      'Traffic',
      'Places and devices',
      'App stats',
    ])
    await expect(canvas.queryByRole('button', { name: /Pageviews/ })).toBeNull()
    // 다시 열어도 꺼져 있고 순서가 그대로다(서버에 저장됐다)
    await userEvent.click(canvas.getByRole('button', { name: 'Reload page' }))
    await canvas.findByRole('heading', { name: 'Visits over time' })
    await expect(cardNames(canvasElement)).toEqual([
      'Pages',
      'Traffic',
      'Places and devices',
      'App stats',
    ])
    await expect(canvas.queryByRole('button', { name: /Pageviews/ })).toBeNull()
  },
}

export const FallsBackToTheBrowserWhenThereIsNoStore: Story = {
  render: () => <Reopenable options={{ layout: 'unavailable' }} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Edit' }))
    await expect(canvas.getByRole('note')).toHaveTextContent('Saved in this browser only')
    await userEvent.click(canvas.getByRole('button', { name: 'Done' }))
    await editAndSave(canvas, userEvent)
    await userEvent.click(canvas.getByRole('button', { name: 'Reload page' }))
    await canvas.findByRole('heading', { name: 'Visits over time' })
    await expect(cardNames(canvasElement)).toEqual([
      'Pages',
      'Traffic',
      'Places and devices',
      'App stats',
    ])
  },
}

export const ResetToTheDefaultLayout: Story = {
  render: () => <Reopenable />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await canvas.findByRole('heading', { name: 'Visits over time' })
    await editAndSave(canvas, userEvent)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit' }))
    // 꺼진 카드와 타일은 편집 중에는 자리에 「꺼짐」으로 남아 다시 켤 수 있다
    await expect(canvas.getByText('Funnel - off')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Reset layout' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Done' }))
    await waitFor(() =>
      expect(cardNames(canvasElement)).toEqual([
        'Traffic',
        'Pages',
        'Places and devices',
        'Funnel',
        'App stats',
      ]),
    )
    await expect(canvas.getByRole('button', { name: /Pageviews/ })).toBeInTheDocument()
  },
}
