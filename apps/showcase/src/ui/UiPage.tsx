import { Section } from '../components/Section'
import { uiEntries } from './uiEntries'
import styles from './UiPage.module.css'

/** `@skeleton/ui` 의 모든 부품을 상태별로 */
export function UiPage() {
  return (
    <div>
      <h2>UI 부품</h2>
      <p className={styles.lead}>
        <code>@skeleton/ui</code> 가 내보내는 모든 부품과 도우미. 마우스를 올리거나 Tab 으로 옮겨
        상태를 눌러 볼 수 있다.
      </p>
      <nav aria-label="UI 부품 목차" className={styles.toc}>
        {uiEntries.map((entry) => (
          <a key={entry.name} href={`#ui-${entry.name}`}>
            {entry.name}
          </a>
        ))}
      </nav>
      {uiEntries.map((entry) => (
        <Section
          key={entry.name}
          id={`ui-${entry.name}`}
          title={`${entry.name} · ${entry.title}`}
          importLine={entry.importLine}
        >
          {entry.render()}
        </Section>
      ))}
    </div>
  )
}
