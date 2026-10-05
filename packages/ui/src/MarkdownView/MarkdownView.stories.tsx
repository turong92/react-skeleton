import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { MarkdownView } from './MarkdownView'

/**
 * 마크다운의 **안전한 부분집합** — 법적 문서(약관 · 개인정보 처리방침) · 안내문. 제목 · 문단 · 목록 · 강조 · 코드 · 링크 · 표만 그리고,
 * 날 HTML · 이미지 · 스크립트는 모른다(보이는 글자로 남는다 — `dangerouslySetInnerHTML` 이 없다). 링크는 http(s) · mailto · tel · 상대 경로만,
 * 바깥 링크는 새 탭 + `rel="noopener noreferrer"`. `{{키}}` 는 `facts` 에서 글자로만 채우고, 없는 키는 표시된 채 남아 빈 문서가 나가지 않게 한다.
 */
const sample = `# Terms of Service

Effective **1 October 2026**. These terms are between you and {{company}}.

## 1. Using the service

- You must be at least 14 years old.
- Keep your account secure:
  - use a unique password
  - tell us at [{{email}}](mailto:{{email}}) if it leaks

See also our [privacy policy](/privacy) and the [GDPR text](https://eur-lex.europa.eu/eli/reg/2016/679/oj).

## 2. Fees

| Plan | Price | Seats |
|:-----|------:|:-----:|
| Free | 0 | 1 |
| Pro | 10 | 5 |
`

const meta = {
  title: 'UI/MarkdownView',
  component: MarkdownView,
  args: {
    source: sample,
    facts: { company: 'Acme Inc.', email: 'help@example.com' },
    headingOffset: 0,
    newTabLabel: '(opens in a new tab)',
  },
} satisfies Meta<typeof MarkdownView>
export default meta
type Story = StoryObj<typeof meta>

export const LegalDocument: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeVisible()
    await expect(canvas.getByText(/between you and Acme Inc\./)).toBeVisible()
    // 한 단계 중첩 목록
    await expect(canvas.getAllByRole('list')).toHaveLength(2)
    // 표 — 머리 · 정렬
    const table = canvas.getByRole('table')
    await expect(table).toBeVisible()
    await expect(canvas.getByRole('columnheader', { name: 'Price' })).toHaveAttribute(
      'data-align',
      'right',
    )
    // 링크 정책
    const external = canvas.getByRole('link', { name: /GDPR text/ })
    await expect(external).toHaveAttribute('target', '_blank')
    await expect(external).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(external).toHaveTextContent('(opens in a new tab)')
    await expect(canvas.getByRole('link', { name: 'privacy policy' })).not.toHaveAttribute('target')
    await expect(canvas.getByRole('link', { name: 'help@example.com' })).toHaveAttribute(
      'href',
      'mailto:help@example.com',
    )
  },
}

export const HeadingOffsetUnderAPageTitle: Story = {
  args: { headingOffset: 1 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 2, name: 'Terms of Service' })).toBeVisible()
    await expect(
      canvas.getByRole('heading', { level: 3, name: '1. Using the service' }),
    ).toHaveAttribute('id', '1-using-the-service')
  },
}

export const HostileInputStaysInert: Story = {
  args: {
    source:
      '<script>window.__pwned = 1</script>\n\n<img src=x onerror="window.__pwned = 2">\n\n[click me](javascript:window.__pwned=3) and [fine]({{target}})',
    facts: { target: '[x](javascript:window.__pwned=4)' },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector('script')).toBeNull()
    await expect(canvasElement.querySelector('img')).toBeNull()
    await expect(canvas.queryByRole('link')).toBeNull()
    await expect(canvas.getByText(/<script>window\.__pwned = 1<\/script>/)).toBeVisible()
    await expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined()
  },
}

export const MissingPlaceholderIsMarked: Story = {
  args: {
    source: 'Operated by {{company}}, contact {{supportEmail}}.',
    facts: { company: 'Acme' },
  },
  play: async ({ canvasElement }) => {
    const missing = canvasElement.querySelector('[data-missing="supportEmail"]')
    await expect(missing).toHaveTextContent('{{supportEmail}}')
    await expect(canvasElement.querySelector('[data-missing="company"]')).toBeNull()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table')).toBeVisible()
  },
}
