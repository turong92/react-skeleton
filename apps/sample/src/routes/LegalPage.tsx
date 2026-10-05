import { LegalDocumentPage } from '@skeleton/marketing'
import { useSearchParams } from 'react-router-dom'
import { legalVersions, type LegalDoc } from '../legal/documents'
import { legalFacts } from '../legal/facts'
import { languageOf, useT } from '../i18n'

/**
 * `/terms` · `/privacy` — Patterns/LegalDocument 를 옮긴 것. 문서는 `src/legal/documents/**` 의 **템플릿** 파일(언어마다 · 판마다 한 파일)이고,
 * 보여 주는 판은 주소의 `?v=` 가 쥔다(링크로 공유된다). 모르는 `?v=` 는 현재 판으로.
 */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const { t, locale } = useT()
  const [params, setParams] = useSearchParams()
  const versions = legalVersions(doc, languageOf(locale))
  const asked = params.get('v') ?? undefined
  const selectedVersion = versions.some((version) => version.version === asked) ? asked : undefined

  return (
    <LegalDocumentPage
      title={t(`legal.${doc}.title`)}
      versions={versions}
      selectedVersion={selectedVersion}
      onVersionChange={(version) => setParams({ v: version }, { replace: true })}
      facts={legalFacts}
      locale={locale === 'ko' ? 'ko-KR' : 'en-US'}
      templateNotice={t('legal.templateNotice')}
      labels={{
        version: (version) => t('legal.version', { version }),
        effective: (date) => t('legal.effective', { date }),
        switcher: t('legal.switcher'),
        olderNotice: (current) => t('legal.older', { current }),
        viewCurrent: t('legal.viewCurrent'),
        upcomingNotice: (date) => t('legal.upcoming', { date }),
        newTab: t('legal.newTab'),
      }}
    />
  )
}
