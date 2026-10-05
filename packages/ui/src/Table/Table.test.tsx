import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Table, type TableColumn } from './Table'

type Row = { id: string; name: string; qty: number }
const rows: Row[] = [
  { id: 'a', name: 'Apple', qty: 3 },
  { id: 'b', name: 'Pear', qty: 12 },
]
const columns: TableColumn<Row>[] = [
  { key: 'name', header: 'Name', rowHeader: true, render: (row) => row.name },
  { key: 'qty', header: 'Qty', align: 'end', render: (row) => row.qty },
]

describe('Table', () => {
  it('renders a real <table> with a caption, scoped column headers and one row per item', () => {
    const html = renderToStaticMarkup(
      <Table caption="Fruit" columns={columns} rows={rows} rowKey={(row) => row.id} />,
    )
    expect(html).toContain('<caption')
    expect(html).toContain('Fruit')
    expect(html.match(/<th[^>]*scope="col"/g)).toHaveLength(2)
    expect(html.match(/<tbody>[\s\S]*<\/tbody>/)![0].match(/<tr/g)).toHaveLength(2)
    expect(html).toContain('Apple')
    expect(html).toContain('>12<')
  })

  it('a rowHeader column is a <th scope="row">', () => {
    const html = renderToStaticMarkup(
      <Table caption="Fruit" columns={columns} rows={rows} rowKey={(row) => row.id} />,
    )
    expect(html.match(/<th[^>]*scope="row"/g)).toHaveLength(2)
  })

  it('end-aligned columns carry data-align so numbers line up', () => {
    const html = renderToStaticMarkup(
      <Table caption="Fruit" columns={columns} rows={rows} rowKey={(row) => row.id} />,
    )
    expect(html).toContain('data-align="end"')
  })

  it('shows the empty slot across all columns when there are no rows', () => {
    const html = renderToStaticMarkup(
      <Table
        caption="Fruit"
        columns={columns}
        rows={[]}
        rowKey={(row) => row.id}
        empty="Nothing here"
      />,
    )
    expect(html).toContain('Nothing here')
    expect(html).toContain('colSpan="2"')
  })

  it('wraps the table in a focusable, labelled scroll region so keyboard users can scroll it', () => {
    const html = renderToStaticMarkup(
      <Table caption="Fruit" columns={columns} rows={rows} rowKey={(row) => row.id} />,
    )
    expect(html).toMatch(
      /^<div[^>]*role="region"[^>]*tabindex="0"|^<div[^>]*tabindex="0"[^>]*role="region"/,
    )
    expect(html).toMatch(/^<div[^>]*aria-label="Fruit"/)
  })
})
