import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect } from 'storybook/test'
import { faqLd } from './jsonLd'
import { Seo, SeoProvider } from './Seo'

/**
 * 화면마다 문서의 머리(제목 · 설명 · canonical · Open Graph · Twitter · JSON-LD · robots)를 맞춘다 — `SeoProvider` 에 사이트 기본값을 한 번,
 * 화면마다 `<Seo title="…" />`. 아무것도 그리지 않고, 전에 만든 `data-seo` 태그만 갈아 끼운다(쌓이지 않는다). 서버 렌더 앱은 첫 응답의 머리를 서버가
 * `buildHeadSpec` + `renderHeadHtml` 로 쓴다(`apps/starter-ssr`). 아래 스토리는 이 문서의 진짜 `<head>` 를 읽어 확인한다.
 */
const meta = {
  title: 'Packages/Seo',
  component: Seo,
} satisfies Meta<typeof Seo>
export default meta
type Story = StoryObj<typeof meta>

const defaults = {
  siteName: 'Notes',
  titleTemplate: '%s · Notes',
  baseUrl: 'https://notes.example.com',
  description: 'Notes for teams',
  locale: 'en_US',
}
const head = (selector: string) => document.head.querySelector(selector)
const content = (selector: string) => head(selector)?.getAttribute('content')

function Pages() {
  const [page, setPage] = useState<'home' | 'pricing'>('home')
  return (
    <SeoProvider defaults={defaults}>
      {page === 'home' ? (
        <Seo canonical="/" />
      ) : (
        <Seo
          title="Pricing"
          description="Simple plans"
          canonical="/pricing#faq"
          jsonLd={faqLd([{ question: 'Is there a free plan?', answer: 'Yes' }])}
          robots="noindex"
        />
      )}
      <button type="button" onClick={() => setPage(page === 'home' ? 'pricing' : 'home')}>
        Switch page
      </button>
    </SeoProvider>
  )
}

export const WritesTheHeadAndFollowsNavigation: Story = {
  render: () => <Pages />,
  play: async ({ canvas, userEvent }) => {
    await expect(document.title).toBe('Notes')
    await expect(head('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://notes.example.com/',
    )
    await expect(content('meta[name="description"]')).toBe('Notes for teams')
    await userEvent.click(canvas.getByRole('button', { name: 'Switch page' }))
    await expect(document.title).toBe('Pricing · Notes')
    await expect(content('meta[name="description"]')).toBe('Simple plans')
    // 해시는 버려진 절대 주소
    await expect(head('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://notes.example.com/pricing',
    )
    await expect(content('meta[property="og:title"]')).toBe('Pricing')
    await expect(content('meta[property="og:url"]')).toBe('https://notes.example.com/pricing')
    await expect(content('meta[name="robots"]')).toBe('noindex')
    const ld = head('script[type="application/ld+json"]')
    await expect(JSON.parse(ld!.textContent!)).toMatchObject({ '@type': 'FAQPage' })
    // 쌓이지 않는다 — 처음 페이지로 돌아오면 이전 페이지의 robots · JSON-LD 가 없다
    await userEvent.click(canvas.getByRole('button', { name: 'Switch page' }))
    await expect(document.title).toBe('Notes')
    await expect(head('meta[name="robots"]')).toBeNull()
    await expect(head('script[type="application/ld+json"]')).toBeNull()
    await expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
  },
}

export const LeavesForeignTagsAlone: Story = {
  render: () => (
    <SeoProvider defaults={defaults}>
      <Seo title="Pricing" />
    </SeoProvider>
  ),
  play: async () => {
    // 스토리집 자신의 <meta charset> 같은 `data-seo` 가 아닌 태그는 그대로다
    await expect(document.head.querySelector('meta[charset]')).not.toBeNull()
    await expect(document.title).toBe('Pricing · Notes')
  },
}
