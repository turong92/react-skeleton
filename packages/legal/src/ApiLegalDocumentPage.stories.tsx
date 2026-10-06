import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useState } from 'react'
import { expect } from 'storybook/test'
import { ApiLegalDocumentPage } from './ApiLegalDocumentPage'
import { koLegalLabels } from './labels'
import { createFakeLegalApi } from './stories/fakeLegalApi'
import { WithQuery } from './stories/WithQuery'

/** 백엔드의 문서를 페이지로 — 마크다운(`MarkdownView`) · 판 · 효력일 · 옛 판 안내 · 예정 판 · 샘플 표시. 서버 문서가 없는 사이트는 `@skeleton/marketing` 의 정적 `LegalDocumentPage` */
function Demo({ type, initial }: { type: string; initial?: string }) {
  const api = useMemo(() => createFakeLegalApi(), [])
  const [version, setVersion] = useState<string | undefined>(initial)
  return (
    <WithQuery>
      <ApiLegalDocumentPage
        api={api}
        type={type}
        version={version}
        onVersionChange={setVersion}
        extraVersions={['2026-01-01']}
        locale="ko-KR"
        labels={koLegalLabels}
      />
    </WithQuery>
  )
}

const meta = { title: 'Packages/Legal/Document page', component: Demo } satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof meta>

export const CurrentVersionWithSampleBannerAndUpcoming: Story = {
  args: { type: 'privacy' },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { level: 1, name: '개인정보 처리방침' }),
    ).toBeVisible()
    await expect(canvas.getByText(/2026-10-01 판 · /)).toBeVisible()
    await expect(canvas.getByText(/샘플 문서예요/)).toBeVisible()
    await expect(canvas.getByText(/2027\. 1\. 1\.에 시행돼요/)).toBeVisible() // 예정 판 공지
    await expect(canvas.getByRole('heading', { level: 2, name: '수집하는 항목' })).toBeVisible() // 마크다운 `#` 는 h2 로 내려온다
  },
}

export const OlderVersionPointsBackToTheCurrentOne: Story = {
  args: { type: 'terms', initial: '2026-01-01' },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText(/지난 판을 보고 있어요/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '현재 판 보기' }))
    await expect(await canvas.findByText(/2026-10-01 판 · /)).toBeVisible()
    await expect(canvas.queryByText(/지난 판을 보고 있어요/)).toBeNull()
  },
}

export const UnknownDocumentShowsAnError: Story = {
  args: { type: 'nope' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('문서를 불러오지 못했어요.')).toBeVisible()
  },
}
