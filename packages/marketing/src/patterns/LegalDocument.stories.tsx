import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect } from 'storybook/test'
// 복사해 쓸 때: 아래 한 줄을 `from '@skeleton/marketing'` 으로
import { LegalDocumentPage } from '../index'

/**
 * 약관 · 개인정보 처리방침 페이지 — 판마다 마크다운(문서 제목은 쓰지 않는다: 페이지의 `h1`. 마크다운의 `#` 은 그 아래 절) + 효력일, 판 바꾸기, 회사 사실(`facts`)로 `{{키}}` 채우기. 복사해서 문서 파일(`?raw` 로 읽은 `.md`)과 `facts` 만 바꾼다.
 * **이 스켈레톤이 주는 문서는 템플릿이다** — `templateNotice` 로 맨 위에 크게 표시되고, 법률 검토 없이 공개하지 않는다(`apps/sample` 의 `src/legal/` 참고).
 * 판은 주소의 `?v=` 로 쥐면 링크로 공유된다(아래는 상태로 쥔 모양).
 */
const meta = {
  title: 'Patterns/LegalDocument',
  parameters: { layout: 'fullscreen' },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const versions = [
  {
    version: '1.0',
    effectiveDate: '2025-01-01',
    markdown:
      'This is the first policy. {{company}} collects only what it needs.\n\n# What we collect\n\n- Account email\n- Notes you write',
  },
  {
    version: '2.0',
    effectiveDate: '2026-10-01',
    markdown:
      '{{company}} collects only what it needs to run the service. Questions: [{{email}}](mailto:{{email}}).\n\n# What we collect\n\n- Account email\n- Notes and attachments you add\n- Anonymous usage counts, only if you allow them\n\n# Your rights\n\n| Right | How |\n|:--|:--|\n| Access | Ask us by email |\n| Deletion | Settings → Delete account |\n\nRead the [terms of service](/terms).',
  },
]

function LegalPage() {
  const [selected, setSelected] = useState<string | undefined>(undefined)
  return (
    <div
      style={{ maxWidth: '72rem', margin: '0 auto', padding: 'var(--space-2xl) var(--space-lg)' }}
    >
      <LegalDocumentPage
        title="Privacy Policy"
        versions={versions}
        selectedVersion={selected}
        onVersionChange={setSelected}
        today="2026-10-06"
        locale="en-US"
        facts={{ company: 'Acme Inc.', email: 'privacy@example.com' }}
        templateNotice="TEMPLATE — this text is a starting point, not legal advice. Have a lawyer review and adapt it before you publish."
      />
    </div>
  )
}

export const Default: Story = {
  render: () => <LegalPage />,
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('TEMPLATE')
    await expect(canvas.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible()
    await expect(canvas.getByRole('heading', { level: 2, name: 'What we collect' })).toBeVisible()
    await userEvent.selectOptions(canvas.getByLabelText('Version'), '1.0')
    await expect(canvas.getByText(/first policy/)).toBeVisible()
    await expect(canvas.getByText(/older version/)).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  render: () => <LegalPage />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table')).toBeVisible()
  },
}
