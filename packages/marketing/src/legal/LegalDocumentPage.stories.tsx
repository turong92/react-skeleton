import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { LegalDocumentPage } from './LegalDocumentPage'
import type { LegalVersion } from './versions'

/**
 * 법적 문서 페이지 — 버전이 있는 마크다운 + 효력일 + 판 바꾸기(마크다운에는 문서 제목을 쓰지 않는다: 페이지의 `h1` 이 제목이고 문서 안의 `#` 은 그 아래 절 `h2`). 본문은 `MarkdownView`(날 HTML 없음 · 안전한 링크 · `{{키}}` 채우기).
 * 옛 판을 고르면 「현재 판 아님」 안내와 현재 판으로 가는 버튼, 아직 효력 전인 판은 시작일을 알린다. 템플릿 문서는 `templateNotice` 로 **크게 표시**한다.
 * 조립한 모습은 `Patterns/LegalDocument`.
 */
const versions: LegalVersion[] = [
  {
    version: '1.0',
    effectiveDate: '2025-01-01',
    markdown:
      'These are the first terms between you and {{company}}.\n\n# Fees\n\nAll plans are free.',
  },
  {
    version: '2.0',
    effectiveDate: '2026-10-01',
    markdown:
      'These terms are between you and {{company}}. Questions: [{{email}}](mailto:{{email}}).\n\n# Fees\n\n| Plan | Price |\n|:--|--:|\n| Free | 0 |\n| Pro | 10 |\n\nSee the [privacy policy](/privacy).',
  },
]
const meta = {
  title: 'Packages/LegalDocumentPage',
  component: LegalDocumentPage,
  args: {
    title: 'Terms of Service',
    versions,
    today: '2026-10-06',
    locale: 'en-US',
    facts: { company: 'Acme Inc.', email: 'legal@example.com' },
  },
} satisfies Meta<typeof LegalDocumentPage>
export default meta
type Story = StoryObj<typeof meta>

export const CurrentVersionAndSwitching: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeVisible()
    await expect(canvas.getByText('Version 2.0 · Effective October 1, 2026')).toBeVisible()
    await expect(canvas.getByText(/between you and Acme Inc\./)).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'legal@example.com' })).toHaveAttribute(
      'href',
      'mailto:legal@example.com',
    )
    await expect(canvas.queryByText(/not the current|older version/i)).toBeNull()
    // 판 바꾸기
    await userEvent.selectOptions(canvas.getByLabelText('Version'), '1.0')
    await expect(canvas.getByText(/first terms between you and Acme Inc\./)).toBeVisible()
    await expect(canvas.getByText(/You are reading an older version/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Read the current version' }))
    await expect(canvas.getByText('Version 2.0 · Effective October 1, 2026')).toBeVisible()
    await expect(canvas.getByLabelText('Version')).toHaveValue('2.0')
  },
}

export const TemplateIsMarkedLoudly: Story = {
  args: {
    templateNotice:
      'TEMPLATE — this text is a starting point, not legal advice. Have a lawyer review it before you publish.',
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('TEMPLATE')
  },
}

export const UnfilledPlaceholderIsVisible: Story = {
  args: { facts: { company: 'Acme Inc.' } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-missing="email"]')).toHaveTextContent(
      '{{email}}',
    )
  },
}

export const UpcomingVersion: Story = {
  args: {
    versions: [
      ...versions,
      {
        version: '3.0',
        effectiveDate: '2027-03-01',
        markdown: 'Future terms for {{company}}.',
      },
    ],
    selectedVersion: '3.0',
    onVersionChange: () => undefined,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('This version takes effect on March 1, 2027.')).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table')).toBeVisible()
  },
}
