import { Button } from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { MaintenancePage, NotFoundPage, ServerErrorPage } from './StatusPage'

/**
 * 상태 화면 — 404 · 500(문의할 때 줄 참조 번호) · 점검 중(돌아올 시각). 제목이 `h1`, 번호는 장식, 갈 곳은 `actions`. 글자는 모두 prop.
 * SPA 는 HTTP 404 를 낼 수 없으니 404 화면 자체를 검색에서 뺀다(앱의 SEO 가 `noindex`). 조립한 모습은 `Patterns/NotFound`.
 */
const meta = {
  title: 'Packages/StatusPage',
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const NotFound: Story = {
  render: () => <NotFoundPage actions={<Button>Back to home</Button>} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Back to home' })).toBeVisible()
  },
}

export const ServerError: Story = {
  render: () => (
    <ServerErrorPage
      reference="4bf92f3577b34da6a3ce929d0e0e4736"
      actions={<Button variant="secondary">Try again</Button>}
    />
  ),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeVisible()
    await expect(canvas.getByText('4bf92f3577b34da6a3ce929d0e0e4736')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Copy' })).toBeVisible()
  },
}

export const Maintenance: Story = {
  render: () => <MaintenancePage until="2026-10-06T15:00:00Z" zone="Asia/Seoul" locale="en-US" />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toBeVisible()
    await expect(canvas.getByText(/Expected back around Oct 7, 2026/)).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  render: () => <NotFoundPage actions={<Button>Back to home</Button>} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 })).toBeVisible()
  },
}
