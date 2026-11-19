import { Alert, Badge, Button, Card, ConfirmDialog, Field, Input, Select, Stat } from '@skeleton/ui'
import { ApiRequestError } from '@skeleton/api-client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import type { BookingApi } from '../bookingApi'
import { koBookingLabels, type BookingLabels } from '../labels'
import { SeatMap } from '../SeatMap'
import type { BookingAdminApi } from './adminApi'
import { defaultBookingAdminLabels, type BookingAdminLabels } from './labels'
import { expandSeatRange } from './seatRange'
import styles from './AdminBookingPools.module.css'

export type AdminBookingPoolsProps = {
  api: BookingAdminApi
  /** 막기 / 풀기에서 배치도를 그리는 데 쓴다(사용자 경로의 스냅샷 - 운영자도 로그인한 사람이다) */
  bookingApi: Pick<BookingApi, 'snapshot'>
  /** 배치도의 읽히는 이름 - 기본 한국어. 운영 화면 문구는 `labels` */
  mapLabels?: BookingLabels
  labels?: BookingAdminLabels
}

const codeOf = (error: unknown) =>
  error instanceof ApiRequestError ? error.apiError.code : undefined
const intOrUndefined = (text: string) =>
  /^\d+$/.test(text.trim()) ? Number(text.trim()) : undefined

function CreatePool({
  api,
  labels,
  onCreated,
}: {
  api: BookingAdminApi
  labels: BookingAdminLabels
  onCreated: (id: string) => void
}) {
  const L = labels.create
  const [form, setForm] = useState({
    name: '',
    opensAt: '',
    closesAt: '',
    maxPerHold: '',
    perAccountLimit: '',
    currency: '',
    holdMinutes: '',
    waitingRoomId: '',
  })
  const [attempted, setAttempted] = useState(false)
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: event.target.value }))
  const maxPerHold = intOrUndefined(form.maxPerHold)
  const opens = form.opensAt ? new Date(form.opensAt) : null
  const valid =
    form.name.trim() !== '' &&
    opens !== null &&
    !Number.isNaN(opens.getTime()) &&
    maxPerHold !== undefined &&
    maxPerHold >= 1
  const create = useMutation({
    mutationFn: () =>
      api.create({
        name: form.name.trim(),
        opensAt: opens!.toISOString(),
        maxPerHold: maxPerHold!,
        ...(form.closesAt ? { closesAt: new Date(form.closesAt).toISOString() } : {}),
        ...(intOrUndefined(form.perAccountLimit)
          ? { perAccountLimit: intOrUndefined(form.perAccountLimit) }
          : {}),
        ...(form.currency.trim() ? { currency: form.currency.trim().toUpperCase() } : {}),
        ...(intOrUndefined(form.holdMinutes)
          ? { holdMinutes: intOrUndefined(form.holdMinutes) }
          : {}),
        ...(form.waitingRoomId.trim() ? { waitingRoomId: form.waitingRoomId.trim() } : {}),
      }),
    onSuccess: (pool) => onCreated(pool.id),
  })
  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setAttempted(true)
    if (valid && !create.isPending) create.mutate()
  }
  return (
    <Card title={L.title}>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <Field
          label={L.name}
          required
          error={attempted && !form.name.trim() ? L.invalid : undefined}
        >
          {(c) => <Input {...c} value={form.name} onChange={set('name')} />}
        </Field>
        <Field label={L.opensAt} required error={attempted && !opens ? L.invalid : undefined}>
          {(c) => (
            <Input {...c} type="datetime-local" value={form.opensAt} onChange={set('opensAt')} />
          )}
        </Field>
        <Field label={L.closesAt}>
          {(c) => (
            <Input {...c} type="datetime-local" value={form.closesAt} onChange={set('closesAt')} />
          )}
        </Field>
        <Field
          label={L.maxPerHold}
          hint={L.maxPerHoldHint}
          required
          error={attempted && (maxPerHold === undefined || maxPerHold < 1) ? L.invalid : undefined}
        >
          {(c) => (
            <Input
              {...c}
              inputMode="numeric"
              value={form.maxPerHold}
              onChange={set('maxPerHold')}
            />
          )}
        </Field>
        <Field label={L.perAccountLimit}>
          {(c) => (
            <Input
              {...c}
              inputMode="numeric"
              value={form.perAccountLimit}
              onChange={set('perAccountLimit')}
            />
          )}
        </Field>
        <Field label={L.currency} hint={L.currencyHint}>
          {(c) => <Input {...c} value={form.currency} onChange={set('currency')} />}
        </Field>
        <Field label={L.holdMinutes}>
          {(c) => (
            <Input
              {...c}
              inputMode="numeric"
              value={form.holdMinutes}
              onChange={set('holdMinutes')}
            />
          )}
        </Field>
        <Field label={L.waitingRoomId}>
          {(c) => <Input {...c} value={form.waitingRoomId} onChange={set('waitingRoomId')} />}
        </Field>
        {create.isError && <Alert tone="danger">{labels.failed}</Alert>}
        <div className={styles.actions}>
          <Button type="submit" loading={create.isPending}>
            {L.submit}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function AddSeats({
  api,
  poolId,
  labels,
  onDone,
}: {
  api: BookingAdminApi
  poolId: string
  labels: BookingAdminLabels
  onDone: () => void
}) {
  const L = labels.seats
  const [form, setForm] = useState({ section: '', rows: '', numbers: '', grade: '', price: '' })
  const [problem, setProblem] = useState<keyof BookingAdminLabels['seats']['problems'] | null>(null)
  const [added, setAdded] = useState<number | null>(null)
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: event.target.value }))
  const add = useMutation({
    mutationFn: (seats: Parameters<BookingAdminApi['addSeats']>[1]) => api.addSeats(poolId, seats),
    onSuccess: (result) => {
      setAdded(result.added)
      onDone()
    },
  })
  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setAdded(null)
    const price = form.price.trim() === '' ? undefined : Number(form.price)
    const result = expandSeatRange({ ...form, price })
    if (!result.ok) return setProblem(result.problem)
    setProblem(null)
    if (!add.isPending) add.mutate(result.seats)
  }
  return (
    <Card title={L.title}>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <Field label={L.section} error={problem === 'section' ? L.problems.section : undefined}>
          {(c) => <Input {...c} value={form.section} onChange={set('section')} />}
        </Field>
        <Field
          label={L.rows}
          hint={L.rowsHint}
          error={problem === 'rows' ? L.problems.rows : undefined}
        >
          {(c) => <Input {...c} value={form.rows} onChange={set('rows')} />}
        </Field>
        <Field
          label={L.numbers}
          hint={L.numbersHint}
          error={
            problem === 'numbers'
              ? L.problems.numbers
              : problem === 'tooMany'
                ? L.problems.tooMany
                : undefined
          }
        >
          {(c) => <Input {...c} value={form.numbers} onChange={set('numbers')} />}
        </Field>
        <Field label={L.grade} error={problem === 'grade' ? L.problems.grade : undefined}>
          {(c) => <Input {...c} value={form.grade} onChange={set('grade')} />}
        </Field>
        <Field
          label={L.price}
          hint={L.priceHint}
          error={problem === 'price' ? L.problems.price : undefined}
        >
          {(c) => <Input {...c} inputMode="numeric" value={form.price} onChange={set('price')} />}
        </Field>
        {add.isError && (
          <Alert tone="danger">
            {codeOf(add.error) === 'BOOKING.SEAT_EXISTS' ? L.exists : labels.failed}
          </Alert>
        )}
        {added !== null && <Alert tone="success">{L.added(added)}</Alert>}
        <div className={styles.actions}>
          <Button type="submit" loading={add.isPending}>
            {L.submit}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function BlockSeats({
  api,
  bookingApi,
  poolId,
  labels,
  mapLabels,
  refresh,
  version,
}: {
  api: BookingAdminApi
  bookingApi: Pick<BookingApi, 'snapshot'>
  poolId: string
  labels: BookingAdminLabels
  mapLabels: BookingLabels
  refresh: () => void
  version: number
}) {
  const L = labels.block
  const [picked, setPicked] = useState<string[]>([])
  const [done, setDone] = useState<number | null>(null)
  const snapshot = useQuery({
    queryKey: ['booking-admin', poolId, 'seats', version],
    queryFn: () => bookingApi.snapshot(poolId),
  })
  const change = useMutation({
    mutationFn: (action: 'block' | 'unblock') => api[action](poolId, picked),
    onSuccess: (result) => {
      setDone(result.changed)
      setPicked([])
      refresh()
    },
  })
  const toggle = (id: string) => {
    setDone(null)
    setPicked((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )
  }
  return (
    <Card title={L.title}>
      <p className={styles.hint}>{L.hint}</p>
      <SeatMap
        seats={snapshot.data?.seats ?? []}
        loaded={snapshot.isSuccess}
        mineIds={picked}
        pickTaken
        onPick={toggle}
        labels={{
          ...mapLabels,
          map: { ...mapLabels.map, states: { ...mapLabels.map.states, mine: L.selected } },
        }}
      />
      {change.isError && (
        <Alert tone="danger">
          {codeOf(change.error) === 'BOOKING.SEAT_IN_USE' ? L.inUse : labels.failed}
        </Alert>
      )}
      {done !== null && <Alert tone="success">{L.done(done)}</Alert>}
      <div className={styles.actions}>
        <Button
          disabled={picked.length === 0}
          loading={change.isPending}
          onClick={() => change.mutate('block')}
        >
          {L.block}
        </Button>
        <Button
          variant="secondary"
          disabled={picked.length === 0 || change.isPending}
          onClick={() => change.mutate('unblock')}
        >
          {L.unblock}
        </Button>
      </div>
    </Card>
  )
}

/**
 * 예약 운영 - 풀 만들기 · 현황(5초 갱신) · 판매 멈춤 / 다시 · 닫기(확인 창) · 자리 범위로 넣기 · 배치도에서 골라 막기 / 풀기.
 * 권한 검사는 서버(`booking.manage` · `booking.read`)가 하고, 화면을 숨기는 일은 앱의 라우트가 한다.
 */
export function AdminBookingPools({
  api,
  bookingApi,
  mapLabels = koBookingLabels,
  labels = defaultBookingAdminLabels,
}: AdminBookingPoolsProps) {
  const client = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [version, setVersion] = useState(0)
  const pools = useQuery({ queryKey: ['booking-admin', 'pools'], queryFn: () => api.list() })
  const current = pools.data?.find((p) => p.id === (selected ?? pools.data?.[0]?.id))
  const stats = useQuery({
    queryKey: ['booking-admin', current?.id, 'stats', version],
    queryFn: () => api.stats(current!.id),
    enabled: current !== undefined,
    refetchInterval: 5000,
  })
  const refresh = () => {
    setVersion((v) => v + 1)
    void client.invalidateQueries({ queryKey: ['booking-admin', 'pools'] })
  }
  const status = useMutation({
    mutationFn: (next: 'ACTIVE' | 'PAUSED' | 'CLOSED') => api.update(current!.id, { status: next }),
    onSuccess: () => {
      setConfirmClose(false)
      refresh()
    },
  })

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>{labels.title}</h2>
      {pools.isSuccess && pools.data.length === 0 && (
        <p className={styles.hint}>{labels.pools.none}</p>
      )}
      {pools.data && pools.data.length > 0 && (
        <Field label={labels.pools.choose}>
          {(c) => (
            <Select
              {...c}
              value={current?.id ?? ''}
              onChange={(event) => setSelected(event.target.value)}
            >
              {pools.data.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({labels.pools.status[p.status]})
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      {current && (
        <>
          <div className={styles.head}>
            <Badge>{labels.pools.status[current.status]}</Badge>
          </div>
          {stats.data && (
            <div className={styles.stats}>
              <Stat label={labels.stats.total} value={stats.data.total} />
              <Stat label={labels.stats.available} value={stats.data.available} />
              <Stat label={labels.stats.held} value={stats.data.held} />
              <Stat label={labels.stats.sold} value={stats.data.sold} />
              <Stat label={labels.stats.blocked} value={stats.data.blocked} />
              <Stat
                label={labels.stats.unfulfilled}
                value={stats.data.unfulfilled}
                hint={stats.data.unfulfilled > 0 ? labels.stats.unfulfilledHint : undefined}
                tone={stats.data.unfulfilled > 0 ? 'warning' : 'neutral'}
              />
            </div>
          )}
          {status.isError && <Alert tone="danger">{labels.failed}</Alert>}
          {current.status !== 'CLOSED' && (
            <div className={styles.actions}>
              {current.status === 'ACTIVE' ? (
                <Button
                  variant="secondary"
                  loading={status.isPending}
                  onClick={() => status.mutate('PAUSED')}
                >
                  {labels.actions.pause}
                </Button>
              ) : (
                <Button loading={status.isPending} onClick={() => status.mutate('ACTIVE')}>
                  {labels.actions.resume}
                </Button>
              )}
              <Button variant="danger" onClick={() => setConfirmClose(true)}>
                {labels.actions.close}
              </Button>
            </div>
          )}
          <ConfirmDialog
            open={confirmClose}
            onClose={() => setConfirmClose(false)}
            onConfirm={() => status.mutate('CLOSED')}
            title={labels.actions.closeTitle}
            description={labels.actions.closeBody}
            confirmLabel={labels.actions.closeConfirm}
            cancelLabel={labels.actions.cancel}
            busy={status.isPending}
          />
          <AddSeats api={api} poolId={current.id} labels={labels} onDone={refresh} />
          <BlockSeats
            api={api}
            bookingApi={bookingApi}
            poolId={current.id}
            labels={labels}
            mapLabels={mapLabels}
            refresh={refresh}
            version={version}
          />
        </>
      )}
      <CreatePool
        api={api}
        labels={labels}
        onCreated={(id) => {
          setSelected(id)
          refresh()
        }}
      />
    </div>
  )
}
