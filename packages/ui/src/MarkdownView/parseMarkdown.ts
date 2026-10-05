/*
 * 마크다운의 「안전한 부분집합」 파서 — 법적 문서 · 안내문용. 제목 · 문단 · 목록(한 단계 중첩) · 강조 · 코드 · 링크 · 표 · 구분선만 안다.
 * 날 HTML · 이미지 · 인용 · 코드 블록은 모른다: 그런 글자는 그냥 글자로 남는다(렌더러가 React 텍스트로 그려 이스케이프한다).
 * 링크 주소는 `safeHref` 를 통과한 것만 링크가 되고, 아니면 링크 글자만 남는다. 입력 크기에 비례하는 재귀가 없다(깊이 상한).
 */
export type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'code'; v: string }
  /** `dynamic` — 주소에 `{{키}}` 가 있어 렌더러가 채운 뒤 `resolveHref` 로 다시 검사한다 */
  | { t: 'link'; href: string; dynamic?: true; c: Inline[] }
  | { t: 'placeholder'; key: string }

export type Align = 'left' | 'center' | 'right' | null
export type ListItem = { c: Inline[]; children?: Block[] }
export type Block =
  | { t: 'heading'; level: number; c: Inline[] }
  | { t: 'paragraph'; c: Inline[] }
  | { t: 'list'; ordered: boolean; items: ListItem[] }
  | { t: 'table'; head: Inline[][]; align: Align[]; rows: Inline[][][] }
  | { t: 'rule' }

const MAX_INLINE_DEPTH = 6
const MAX_LIST_DEPTH = 3
const PUNCTUATION = '\\`*_{}[]()#+-.!|<>'

/** 링크로 써도 되는 주소만 돌려준다(아니면 null). 허용: http(s) · mailto · tel · `/경로` · `#앵커` · `?질의` · `./` `../` 상대 경로 */
export function safeHref(raw: string): string | null {
  // 공백 · 제어 문자 · 따옴표 · 꺾쇠 · 역슬래시가 하나라도 있으면 거절 — 브라우저가 `java\tscript:` 의 탭을 지우고 실행하는 우회를 막는다
  // eslint-disable-next-line no-control-regex -- 제어 문자를 찾는 것이 목적이다
  if (!raw || /[\u0000-\u0020\u007f-\u009f\u2028\u2029"'<>\\`]/.test(raw)) return null
  const scheme = /^(https?|mailto|tel):/i.exec(raw)
  if (scheme) {
    const rest = raw.slice(scheme[0].length)
    const ok = /^https?$/i.test(scheme[1]) ? /^\/\/[^/?#]+/.test(rest) : rest.length > 0
    return ok ? scheme[1].toLowerCase() + raw.slice(scheme[1].length) : null
  }
  if (/^\/(?![/\\])/.test(raw) || /^[#?]/.test(raw) || /^\.\.?\//.test(raw)) return raw
  return null
}

/** 제목 → 앵커 id(한글 유지) */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'section'
}

const PLACEHOLDER = /^\{\{\s*([A-Za-z0-9_.-]{1,64})\s*\}\}/
const PLACEHOLDER_ANYWHERE = /\{\{\s*([A-Za-z0-9_.-]{1,64})\s*\}\}/g

/** 주소의 `{{키}}` 를 `facts` 로 채운 뒤 `safeHref` 로 다시 검사한다 — 못 채운 키가 있거나 채운 결과가 안전하지 않으면 null(링크가 아니라 글자로) */
export function resolveHref(
  href: string,
  facts: Record<string, string | number> | undefined,
): string | null {
  let missing = false
  const filled = href.replace(PLACEHOLDER_ANYWHERE, (_, key: string) => {
    if (facts && Object.hasOwn(facts, key)) return String(facts[key])
    missing = true
    return ''
  })
  return missing ? null : safeHref(filled)
}

/** 문서에 나오는 `{{키}}` 목록(코드 안은 뺀다, 처음 나온 순서, 중복 없이) */
export function placeholdersOf(source: string): string[] {
  const keys: string[] = []
  const walk = (nodes: Inline[]) => {
    for (const node of nodes) {
      if (node.t === 'placeholder' && !keys.includes(node.key)) keys.push(node.key)
      else if ('c' in node) {
        if (node.t === 'link' && node.dynamic)
          for (const match of node.href.matchAll(PLACEHOLDER_ANYWHERE))
            if (!keys.includes(match[1])) keys.push(match[1])
        walk(node.c)
      }
    }
  }
  const visit = (blocks: Block[]) => {
    for (const block of blocks) {
      if (block.t === 'heading' || block.t === 'paragraph') walk(block.c)
      else if (block.t === 'list')
        for (const item of block.items) {
          walk(item.c)
          if (item.children) visit(item.children)
        }
      else if (block.t === 'table') {
        for (const cell of block.head) walk(cell)
        for (const row of block.rows) for (const cell of row) walk(cell)
      }
    }
  }
  visit(parseMarkdown(source))
  return keys
}

const isWordChar = (char: string | undefined) => char !== undefined && /[\p{L}\p{N}]/u.test(char)

function parseInline(src: string, depth = 0, noLink = false): Inline[] {
  const out: Inline[] = []
  let buffer = ''
  const flush = () => {
    if (buffer) out.push({ t: 'text', v: buffer })
    buffer = ''
  }
  let i = 0
  while (i < src.length) {
    const char = src[i]
    if (char === '\\' && i + 1 < src.length && PUNCTUATION.includes(src[i + 1])) {
      buffer += src[i + 1]
      i += 2
      continue
    }
    if (char === '`') {
      const end = src.indexOf('`', i + 1)
      if (end > i + 1) {
        flush()
        out.push({ t: 'code', v: src.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }
    if (char === '{' && src[i + 1] === '{') {
      const match = PLACEHOLDER.exec(src.slice(i, i + 80))
      if (match) {
        flush()
        out.push({ t: 'placeholder', key: match[1] })
        i += match[0].length
        continue
      }
    }
    if (char === '[' && !noLink && depth < MAX_INLINE_DEPTH) {
      const match = /^\[((?:\\.|[^\]\\])*)\]\(((?:[^\s()]|\([^\s()]*\))*)\)/.exec(src.slice(i))
      if (match) {
        flush()
        const children = parseInline(match[1], depth + 1, true)
        const dynamic = /\{\{/.test(match[2])
        const href = dynamic ? match[2] : safeHref(match[2])
        if (href)
          out.push({ t: 'link', href, ...(dynamic ? { dynamic: true as const } : {}), c: children })
        else out.push(...children)
        i += match[0].length
        continue
      }
    }
    if ((char === '*' || char === '_') && depth < MAX_INLINE_DEPTH) {
      const double = src[i + 1] === char
      const delimiter = double ? char + char : char
      const end = src.indexOf(delimiter, i + delimiter.length)
      const wordInternal =
        char === '_' && (isWordChar(src[i - 1]) || isWordChar(src[end + delimiter.length]))
      if (
        end > i + delimiter.length &&
        !wordInternal &&
        !/^\s/.test(src.slice(i + delimiter.length, i + delimiter.length + 1))
      ) {
        flush()
        const inner = parseInline(src.slice(i + delimiter.length, end), depth + 1, noLink)
        out.push(double ? { t: 'strong', c: inner } : { t: 'em', c: inner })
        i = end + delimiter.length
        continue
      }
    }
    buffer += char
    i += 1
  }
  flush()
  return out
}

const HEADING = /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/
const RULE = /^ {0,3}([-*_])(?: *\1){2,} *$/
const MARKER = /^( *)([-*+]|\d{1,9}[.)])\s+(.*)$/
const DELIMITER = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/

function splitRow(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === '\\' && line[i + 1] === '|') {
      cell += '|'
      i += 1
    } else if (line[i] === '|') {
      cells.push(cell)
      cell = ''
    } else cell += line[i]
  }
  cells.push(cell)
  if (cells.length > 0 && cells[0].trim() === '') cells.shift()
  if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop()
  return cells.map((text) => text.trim())
}

const isTableStart = (lines: string[], i: number) =>
  lines[i].includes('|') &&
  i + 1 < lines.length &&
  lines[i + 1].includes('-') &&
  DELIMITER.test(lines[i + 1]) &&
  (lines[i + 1].includes('|') || lines[i].includes('|')) &&
  splitRow(lines[i]).length === splitRow(lines[i + 1]).length

const startsBlock = (lines: string[], i: number) =>
  HEADING.test(lines[i]) || RULE.test(lines[i]) || MARKER.test(lines[i]) || isTableStart(lines, i)

function parseList(lines: string[], start: number, depth: number): { block: Block; next: number } {
  const first = MARKER.exec(lines[start])!
  const indent = first[1].length
  const ordered = /\d/.test(first[2][0])
  const items: ListItem[] = []
  let i = start
  while (i < lines.length) {
    if (lines[i].trim() === '') {
      // 빈 줄 하나를 건너 같은 목록의 다음 항목이 이어지면 계속
      let j = i
      while (j < lines.length && lines[j].trim() === '') j += 1
      const next = j < lines.length ? MARKER.exec(lines[j]) : null
      if (next && next[1].length <= indent + 1 && /\d/.test(next[2][0]) === ordered) {
        i = j
        continue
      }
      break
    }
    const match = MARKER.exec(lines[i])
    if (!match || match[1].length > indent + 1 || match[1].length < indent - 1) break
    if (/\d/.test(match[2][0]) !== ordered) break
    let text = match[3]
    const children: Block[] = []
    i += 1
    while (i < lines.length && lines[i].trim() !== '') {
      const nested = MARKER.exec(lines[i])
      if (nested && nested[1].length > indent + 1 && depth < MAX_LIST_DEPTH) {
        const result = parseList(lines, i, depth + 1)
        children.push(result.block)
        i = result.next
        continue
      }
      if (nested) break
      if (lines[i].search(/\S/) <= indent) break
      text += ` ${lines[i].trim()}`
      i += 1
    }
    items.push({ c: parseInline(text), ...(children.length ? { children } : {}) })
  }
  return { block: { t: 'list', ordered, items }, next: i }
}

export function parseMarkdown(source: string): Block[] {
  const lines = source
    .replace(/\r\n?|\u2028|\u2029/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\t/g, '    '))
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      i += 1
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push({ t: 'heading', level: heading[1].length, c: parseInline(heading[2]) })
      i += 1
    } else if (RULE.test(line)) {
      blocks.push({ t: 'rule' })
      i += 1
    } else if (isTableStart(lines, i)) {
      const head = splitRow(line)
      const align = splitRow(lines[i + 1]).map<Align>((spec) =>
        spec.startsWith(':') && spec.endsWith(':')
          ? 'center'
          : spec.endsWith(':')
            ? 'right'
            : spec.startsWith(':')
              ? 'left'
              : null,
      )
      const rows: Inline[][][] = []
      i += 2
      while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) {
        const cells = splitRow(lines[i])
        rows.push(head.map((_, column) => parseInline(cells[column] ?? '')))
        i += 1
      }
      blocks.push({ t: 'table', head: head.map((cell) => parseInline(cell)), align, rows })
    } else if (MARKER.test(line)) {
      const result = parseList(lines, i, 0)
      blocks.push(result.block)
      i = result.next
    } else {
      const text = [line.trim()]
      i += 1
      while (i < lines.length && lines[i].trim() !== '' && !startsBlock(lines, i)) {
        text.push(lines[i].trim())
        i += 1
      }
      blocks.push({ t: 'paragraph', c: parseInline(text.join(' ')) })
    }
  }
  return blocks
}
