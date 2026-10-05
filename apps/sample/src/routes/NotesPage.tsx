import { formatRelative } from '@skeleton/time'
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Pagination,
  Select,
  Spinner,
  Table,
  type TableColumn,
} from '@skeleton/ui'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LoadError } from '../components/LoadError'
import { NoteStatusBadge } from '../components/NoteStatusBadge'
import { hasFilters, queryFromSearch, searchFromQuery } from '../notes/listParams'
import { useNotes } from '../notes/queries'
import { NOTE_STATUSES, type Note, type NotesQuery } from '../notes/types'
import { useT } from '../i18n'
import styles from './NotesPage.module.css'

type Translate = ReturnType<typeof useT>['t']

function columnsOf(t: Translate): TableColumn<Note>[] {
  return [
    {
      key: 'title',
      header: t('notes.columnTitle'),
      rowHeader: true,
      render: (note) => (
        <span className={styles.titleCell}>
          <Link to={`/notes/${note.id}`}>{note.title}</Link>
          {note.pinned && <Badge tone="info">{t('notes.pinned')}</Badge>}
          {note.attachmentName && <Badge>{t('notes.hasAttachment')}</Badge>}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('notes.columnStatus'),
      render: (note) => <NoteStatusBadge status={note.status} />,
    },
    {
      key: 'updated',
      header: t('notes.columnUpdated'),
      render: (note) => <span className={styles.nowrap}>{formatRelative(note.updatedAt)}</span>,
    },
  ]
}

/** 검색칸 — 입력은 바로 보이고, 서버 조건(주소)은 멈춘 뒤에 반영한다. 주소의 값이 바뀌면(필터 지우기) `key` 로 새로 시작한다 */
function SearchBox({ value, onCommit }: { value: string; onCommit: (q: string) => void }) {
  const { t } = useT()
  const [typed, setTyped] = useState(value)
  const commit = useRef(onCommit)
  useEffect(() => {
    commit.current = onCommit
  })
  useEffect(() => {
    if (typed.trim() === value) return
    const timer = setTimeout(() => commit.current(typed.trim()), 300)
    return () => clearTimeout(timer)
  }, [typed, value])
  return (
    <Field label={t('notes.search')}>
      {(control) => (
        <Input
          {...control}
          type="search"
          placeholder={t('notes.searchPlaceholder')}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
      )}
    </Field>
  )
}

/** Patterns/List page — 검색 · 필터(주소에 남는다) · 표 · 쪽 이동 · 빈 상태(처음 · 결과 없음) · 로딩 · 오류 */
export function NotesPage() {
  const { t } = useT()
  const [search, setSearch] = useSearchParams()
  const navigate = useNavigate()
  const query = queryFromSearch(search)
  const notes = useNotes(query)

  function change(patch: Partial<NotesQuery>) {
    setSearch(searchFromQuery({ ...query, ...patch }))
  }
  const create = <Button onClick={() => navigate('/notes/new')}>{t('notes.create')}</Button>
  const filtered = hasFilters(query)

  return (
    <div className={styles.page}>
      <PageHeader title={t('notes.title')} description={t('notes.subtitle')} actions={create} />

      <form
        className={styles.toolbar}
        role="search"
        aria-label={t('notes.search')}
        onSubmit={(event) => event.preventDefault()}
      >
        <SearchBox key={query.q} value={query.q ?? ''} onCommit={(q) => change({ q, page: 0 })} />
        <Field label={t('notes.statusFilter')}>
          {(control) => (
            <Select
              {...control}
              value={query.status}
              onChange={(event) =>
                change({ status: event.target.value as NotesQuery['status'], page: 0 })
              }
            >
              <option value="">{t('notes.allStatuses')}</option>
              {NOTE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`status.${status}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Checkbox
          label={t('notes.pinnedOnly')}
          checked={query.pinned === true}
          onChange={(event) => change({ pinned: event.target.checked || undefined, page: 0 })}
        />
      </form>

      {notes.isPending && <Spinner label={t('common.loading')} />}
      {notes.isError && <LoadError error={notes.error} onRetry={() => void notes.refetch()} />}
      {notes.data && (
        <>
          <Table
            caption={t('notes.caption')}
            columns={columnsOf(t)}
            rows={notes.data.values}
            rowKey={(note) => note.id}
            empty={
              filtered ? (
                <EmptyState
                  headingLevel={2}
                  title={t('notes.noResultsTitle')}
                  description={t('notes.noResultsBody')}
                  action={
                    <Button variant="secondary" onClick={() => setSearch(new URLSearchParams())}>
                      {t('notes.clearFilters')}
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  headingLevel={2}
                  title={t('notes.emptyTitle')}
                  description={t('notes.emptyBody')}
                  action={create}
                />
              )
            }
          />
          <Pagination
            page={notes.data.pagination.page}
            totalPages={notes.data.pagination.totalPages}
            onPageChange={(page) => change({ page })}
            label={t('notes.pagination.label')}
            previousLabel={t('notes.pagination.previous')}
            nextLabel={t('notes.pagination.next')}
            pageLabel={(n) => `${n}쪽`}
          />
        </>
      )}
    </div>
  )
}
