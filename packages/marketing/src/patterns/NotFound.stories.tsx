import { Button } from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
// 복사해 쓸 때: 아래 한 줄을 `from '@skeleton/marketing'` 으로
import { MaintenancePage, NotFoundPage, ServerErrorPage } from '../index'

/**
 * 길을 잃었을 때의 화면 셋 — 404(없는 주소) · 500(우리 쪽 오류, 문의용 참조 번호) · 점검 중(돌아올 시각). 이유를 말하고 갈 곳을 준다.
 * 복사해서 문구와 `actions`(홈 링크 · 다시 시도)만 바꾼다. SPA 는 HTTP 404 를 못 내니 앱의 SEO 로 이 화면을 `noindex` 한다(`apps/sample` 의 라우트 `handle`).
 * 라우터의 `errorElement` 에 `ServerErrorPage` 를, `*` 라우트에 `NotFoundPage` 를 둔다.
 */
const meta = {
  title: 'Patterns/NotFound',
  parameters: { layout: 'fullscreen' },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <NotFoundPage
      title="We cannot find that page"
      description="The address may be mistyped, or the page has moved."
      actions={
        <>
          <Button>Back to home</Button>
          <Button variant="secondary">Search the help centre</Button>
        </>
      }
    />
  ),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'We cannot find that page' }),
    ).toBeVisible()
    await expect(canvas.getByText('404')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Back to home' })).toBeVisible()
  },
}

export const ServerError: Story = {
  render: () => (
    <ServerErrorPage
      reference="4bf92f3577b34da6a3ce929d0e0e4736"
      actions={<Button>Try again</Button>}
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText('4bf92f3577b34da6a3ce929d0e0e4736')).toBeVisible()
  },
}

export const Maintenance: Story = {
  render: () => <MaintenancePage until="2026-10-06T15:00:00Z" zone="Asia/Seoul" locale="en-US" />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  render: () => <NotFoundPage actions={<Button>Back to home</Button>} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 })).toBeVisible()
  },
}
