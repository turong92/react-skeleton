import { Button, LanguageMenu } from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, waitFor } from 'storybook/test'
import { createI18n } from './createI18n'
import { I18nProvider } from './I18nProvider'
import { useT } from './useT'

/**
 * 앱 문구의 정본 사용법 — 사전(ICU 메시지)을 `createI18n` 에 주고 `I18nProvider` 로 건넨 뒤 `useT()` 로 읽는다.
 * `@skeleton/ui` 의 부품은 i18n 을 모른다: 번역한 글자를 prop 으로 넘기면 된다(`<LanguageMenu label={t('language.label')} … />`).
 * 영어 사전은 지연 로딩(`() => import('./en')` 꼴)이라 고를 때 도착한 뒤에 바뀐다.
 */
const ko = {
  'language.label': '언어',
  'inbox.title': '받은편지함',
  'inbox.count': '{count, plural, =0 {새 메일이 없어요} other {새 메일 #통}}',
  'inbox.hint': '<b>{name}</b>님, 오늘도 <link>메일 확인하기</link>',
  'inbox.refresh': '새로 고침',
}
const en: typeof ko = {
  'language.label': 'Language',
  'inbox.title': 'Inbox',
  'inbox.count': '{count, plural, =0 {No new mail} one {# new message} other {# new messages}}',
  'inbox.hint': 'Hi <b>{name}</b>, <link>check your mail</link> today',
  'inbox.refresh': 'Refresh',
}

function Inbox({ count }: { count: number }) {
  const { t, tRich, locale, localeOptions, setLocale } = useT<keyof typeof ko>()
  return (
    <section style={{ display: 'grid', gap: 'var(--space-md)', maxWidth: '28rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{t('inbox.title')}</h2>
        <LanguageMenu
          label={t('language.label')}
          value={locale}
          options={localeOptions}
          onChange={(next) => void setLocale(next as 'ko' | 'en')}
        />
      </div>
      <p>{t('inbox.count', { count })}</p>
      <p>
        {tRich('inbox.hint', {
          name: 'Ada',
          b: (chunks) => <strong>{chunks}</strong>,
          link: (chunks) => <a href="#mail">{chunks}</a>,
        })}
      </p>
      <div>
        <Button variant="secondary">{t('inbox.refresh')}</Button>
      </div>
    </section>
  )
}

function Demo({ count }: { count: number }) {
  const [i18n] = useState(() =>
    createI18n({
      catalogs: { ko, en: () => Promise.resolve({ default: en }) },
      defaultLocale: 'ko',
      storageKey: 'storybook:i18n',
      storage: null,
      setDocumentLang: false,
    }),
  )
  return (
    <I18nProvider i18n={i18n}>
      <Inbox count={count} />
    </I18nProvider>
  )
}

const meta = {
  title: 'Packages/i18n',
  component: Demo,
  args: { count: 3 },
} satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof meta>

export const StartsInTheDefaultLanguage: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: '받은편지함' })).toBeVisible()
    await expect(canvas.getByText('새 메일 3통')).toBeVisible()
    await expect(canvas.getByRole('combobox', { name: '언어' })).toHaveDisplayValue('한국어')
  },
}

export const SwitchingRedrawsInPlaceAndRelabelsTheMenuItself: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: '언어' }), 'en')
    await waitFor(() => expect(canvas.getByRole('heading', { name: 'Inbox' })).toBeVisible())
    await expect(canvas.getByText('3 new messages')).toBeVisible()
    // 메뉴의 이름도 새 언어로 — 선택지는 계속 자기 말로
    const menu = canvas.getByRole('combobox', { name: 'Language' })
    await expect(menu).toHaveDisplayValue('English')
    await expect(canvas.getByRole('option', { name: '한국어' })).toBeInTheDocument()
  },
}

export const PluralFollowsTheLanguageRules: Story = {
  args: { count: 1 },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText('새 메일 1통')).toBeVisible()
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: '언어' }), 'en')
    await expect(await canvas.findByText('1 new message')).toBeVisible()
  },
}

export const RichTextKeepsOneSentenceSoWordOrderCanChange: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('link', { name: '메일 확인하기' })).toHaveAttribute(
      'href',
      '#mail',
    )
    await expect(canvas.getByText('Ada').tagName).toBe('STRONG')
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: '언어' }), 'en')
    await expect(await canvas.findByRole('link', { name: 'check your mail' })).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: '받은편지함' })).toBeVisible()
  },
}
