import type { ReactNode } from 'react'
import { readSemanticTokens, THEME_NAMES, type SemanticToken, type ThemeName } from './tokenData'
import styles from './TokensPage.module.css'

const COLOR_GROUPS = ['surface', 'text', 'border', 'status']
const inGroups = (tokens: SemanticToken[], groups: string[]) =>
  tokens.filter((token) => groups.includes(token.group))

/** 한 묶음 — 제목 + 본문 */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.group}>
      <h4>{title}</h4>
      {children}
    </section>
  )
}

function Meta({ token, theme }: { token: SemanticToken; theme: ThemeName }) {
  return (
    <span className={styles.meta}>
      <code>{token.cssName}</code>
      <span className={styles.value}>{token.values[theme]}</span>
    </span>
  )
}

function Panel({ theme, tokens }: { theme: ThemeName; tokens: SemanticToken[] }) {
  const type = tokens.filter((token) => token.group === 'type' && token.cssName.includes('size'))
  return (
    <div data-theme={theme} className={styles.panel}>
      <h3 className={styles.panelTitle}>{theme}</h3>
      <Group title="Colors">
        <ul className={styles.swatches}>
          {inGroups(tokens, COLOR_GROUPS).map((token) => (
            <li key={token.cssName} className={styles.swatch}>
              <span className={styles.chip} style={{ background: `var(${token.cssName})` }} />
              <Meta token={token} theme={theme} />
            </li>
          ))}
        </ul>
      </Group>
      <Group title="Spacing">
        <ul className={styles.list}>
          {tokens
            .filter((token) => token.group === 'spacing')
            .map((token) => (
              <li key={token.cssName} className={styles.line}>
                <span className={styles.bar} style={{ width: `var(${token.cssName})` }} />
                <Meta token={token} theme={theme} />
              </li>
            ))}
        </ul>
      </Group>
      <Group title="Radius">
        <ul className={styles.swatches}>
          {tokens
            .filter((token) => token.group === 'radius')
            .map((token) => (
              <li key={token.cssName} className={styles.swatch}>
                <span className={styles.box} style={{ borderRadius: `var(${token.cssName})` }} />
                <Meta token={token} theme={theme} />
              </li>
            ))}
        </ul>
      </Group>
      <Group title="Type scale">
        <ul className={styles.list}>
          {type.map((token) => (
            <li key={token.cssName} className={styles.line}>
              <span style={{ fontSize: `var(${token.cssName})` }}>Aa 가나다</span>
              <Meta token={token} theme={theme} />
            </li>
          ))}
        </ul>
      </Group>
      <Group title="Shadows">
        <ul className={styles.swatches}>
          {tokens
            .filter((token) => token.group === 'effect')
            .map((token) => (
              <li key={token.cssName} className={styles.swatch}>
                <span className={styles.box} style={{ boxShadow: `var(${token.cssName})` }} />
                <Meta token={token} theme={theme} />
              </li>
            ))}
        </ul>
      </Group>
    </div>
  )
}

/** 실제 tokens.json 에서 읽은 값 — 라이트 · 다크를 같은 화면에 나란히(컨테이너에 `data-theme` 를 달아 그 안만 바꾼다) */
export function TokensPage() {
  const tokens = readSemanticTokens()
  return (
    <div className={styles.page}>
      <h2>Design tokens</h2>
      <p className={styles.lead}>
        <code>packages/tokens/tokens.json</code> 에서 읽은 의미 토큰. 값은 그 테마에서 끝까지 푼
        값이다.
      </p>
      <div className={styles.themes}>
        {THEME_NAMES.map((theme) => (
          <Panel key={theme} theme={theme} tokens={tokens} />
        ))}
      </div>
    </div>
  )
}
