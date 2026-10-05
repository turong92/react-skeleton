import { createElement, Fragment, type ReactNode } from 'react'
import styles from './MarkdownView.module.css'
import { parseMarkdown, resolveHref, slugify, type Block, type Inline } from './parseMarkdown'

export type MarkdownFacts = Record<string, string | number>

export type MarkdownViewProps = {
  source: string
  /** `{{키}}` 자리에 들어갈 값 — 글자로만 들어간다(값에 마크다운 · HTML 이 있어도 구조가 되지 않는다). 없는 키는 표시된 채 남는다 */
  facts?: MarkdownFacts
  /** 제목 수준을 이만큼 내린다(문서 제목을 화면의 `h1` 로 이미 쓴다면 1) — 최대 `h6` */
  headingOffset?: number
  /** 바깥(http · https) 링크를 새 탭(기본)으로 열지 같은 탭(`self`)으로 열지. 두 경우 모두 `rel="noopener noreferrer"` */
  externalLinkTarget?: 'blank' | 'self'
  /** 새 탭으로 열리는 링크 뒤에 붙는 보이지 않는 안내(기본 영어) */
  newTabLabel?: string
  /** 제목 앵커 id 앞에 붙일 말 — 한 화면에 문서가 둘 이상일 때 */
  idPrefix?: string
  className?: string
}

const isExternal = (href: string) => /^https?:/i.test(href)

function renderInline(
  nodes: Inline[],
  facts: MarkdownFacts | undefined,
  options: Required<Pick<MarkdownViewProps, 'externalLinkTarget' | 'newTabLabel'>>,
): ReactNode {
  return nodes.map((node, index) => {
    switch (node.t) {
      case 'text':
        return <Fragment key={index}>{node.v}</Fragment>
      case 'strong':
        return <strong key={index}>{renderInline(node.c, facts, options)}</strong>
      case 'em':
        return <em key={index}>{renderInline(node.c, facts, options)}</em>
      case 'code':
        return (
          <code key={index} className={styles.code}>
            {node.v}
          </code>
        )
      case 'link': {
        const href = node.dynamic ? resolveHref(node.href, facts) : node.href
        // 못 채우거나 채운 결과가 안전하지 않은 주소는 링크가 아니라 글자
        if (!href) return <Fragment key={index}>{renderInline(node.c, facts, options)}</Fragment>
        const external = isExternal(href)
        const blank = external && options.externalLinkTarget === 'blank'
        return (
          <a
            key={index}
            className={styles.link}
            href={href}
            rel={external ? 'noopener noreferrer' : undefined}
            target={blank ? '_blank' : undefined}
          >
            {renderInline(node.c, facts, options)}
            {blank && <span className={styles.srOnly}> {options.newTabLabel}</span>}
          </a>
        )
      }
      case 'placeholder':
        // `hasOwn` — `{{constructor}}` 같은 키가 Object.prototype 을 읽지 않게
        return facts && Object.hasOwn(facts, node.key) ? (
          <Fragment key={index}>{String(facts[node.key])}</Fragment>
        ) : (
          <mark key={index} className={styles.missing} data-missing={node.key}>
            {`{{${node.key}}}`}
          </mark>
        )
    }
  })
}

/** 마크다운의 안전한 부분집합을 그린다 — 법적 문서 · 안내문. `dangerouslySetInnerHTML` 이 없다: 모든 글자는 React 텍스트라 날 HTML 은 보이는 글자일 뿐이다. */
export function MarkdownView({
  source,
  facts,
  headingOffset = 0,
  externalLinkTarget = 'blank',
  newTabLabel = '(opens in a new tab)',
  idPrefix = '',
  className,
}: MarkdownViewProps) {
  const options = { externalLinkTarget, newTabLabel }
  const usedIds = new Map<string, number>()
  const idFor = (title: string) => {
    const base = `${idPrefix}${slugify(title)}`
    const count = usedIds.get(base) ?? 0
    usedIds.set(base, count + 1)
    return count === 0 ? base : `${base}-${count + 1}`
  }
  const plain = (nodes: Inline[]): string =>
    nodes
      .map((node) =>
        node.t === 'text' || node.t === 'code'
          ? node.v
          : node.t === 'placeholder'
            ? facts && Object.hasOwn(facts, node.key)
              ? String(facts[node.key])
              : node.key
            : plain(node.c),
      )
      .join('')

  const renderBlock = (block: Block, index: number): ReactNode => {
    switch (block.t) {
      case 'heading':
        return createElement(
          `h${Math.min(6, block.level + Math.max(0, headingOffset))}`,
          { key: index, id: idFor(plain(block.c)), className: styles.heading },
          renderInline(block.c, facts, options),
        )
      case 'paragraph':
        return (
          <p key={index} className={styles.paragraph}>
            {renderInline(block.c, facts, options)}
          </p>
        )
      case 'list': {
        const Tag = block.ordered ? 'ol' : 'ul'
        return (
          <Tag key={index} className={styles.list}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                {renderInline(item.c, facts, options)}
                {item.children?.map(renderBlock)}
              </li>
            ))}
          </Tag>
        )
      }
      case 'table':
        return (
          <table key={index} className={styles.table}>
            <thead>
              <tr>
                {block.head.map((cell, column) => (
                  <th key={column} scope="col" data-align={block.align[column] ?? undefined}>
                    {renderInline(cell, facts, options)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, column) => (
                    <td key={column} data-align={block.align[column] ?? undefined}>
                      {renderInline(cell, facts, options)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )
      case 'rule':
        return <hr key={index} className={styles.rule} />
    }
  }

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      {parseMarkdown(source).map(renderBlock)}
    </div>
  )
}
