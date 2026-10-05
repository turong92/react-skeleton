import { Button, EmptyState } from '@skeleton/ui'
import { Link, useParams } from 'react-router-dom'
import { Section } from '../components/Section'
import { packageSections, type PackageSection } from '../demos/packageSections'

export function HomePage() {
  return (
    <div>
      <h2>react-skeleton 쇼케이스</h2>
      <p>스켈레톤이 주는 것을 브라우저에서 눌러 본다. 백엔드 없이 모두 가짜 전송 위에서 돈다.</p>
      <ul>
        <li>
          <Link to="/ui">UI 부품</Link> — 모든 부품을 상태별로
        </li>
        <li>
          <Link to="/tokens">디자인 토큰</Link> — 색 · 간격 · 모서리 · 글자 · 그림자, 라이트와 다크
          나란히
        </li>
        {packageSections.map((section) => (
          <li key={section.slug}>
            <Link to={`/packages/${section.slug}`}>{section.pkg}</Link> — {section.summary}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PackagePage({ section }: { section: PackageSection }) {
  return (
    <div>
      <h2>{section.pkg}</h2>
      <p>{section.summary}</p>
      <Section title={section.title} importLine={section.importLine}>
        <section.Demo />
      </Section>
    </div>
  )
}

export function NotFoundPage() {
  const { '*': rest } = useParams()
  return (
    <EmptyState
      headingLevel={2}
      title="404 — Not Found"
      description={`/${rest ?? ''} 는 없는 섹션입니다.`}
      action={
        <Link to="/">
          <Button variant="secondary">← 개요로</Button>
        </Link>
      }
    />
  )
}
