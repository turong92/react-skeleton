import { Alert } from '@skeleton/ui'
import { useMemo } from 'react'
import type { FeedConnection } from './seatFeed'
import { formatMoney, naturalCompare } from './format'
import { defaultBookingLabels, type BookingLabels } from './labels'
import type { Seat } from './types'
import styles from './SeatMap.module.css'

export type SeatMapProps = {
  seats: Seat[]
  /** 내 보류에 든 자리 id */
  mineIds?: readonly string[]
  /** 응답을 기다리는 자리 - 그 단추만 잠긴다 */
  pendingIds?: readonly string[]
  /** 선택 불가 자리도 누를 수 있다(운영 화면이 막힌 자리를 풀 때) */
  pickTaken?: boolean
  /** 모든 자리를 잠근다(결제 중 · 시간이 지남 · 입장권 없음) - 내 자리도 눌리지 않는다 */
  disabled?: boolean
  /** 스냅샷을 한 번이라도 읽었는가 - 아니면 「불러오는 중」 */
  loaded?: boolean
  /** `reconnecting` 이면 배치도 위에 「다시 연결하는 중」 한 줄 */
  connection?: FeedConnection
  /** 가격 표시용 */
  currency?: string
  locale?: string
  onPick: (seatId: string) => void
  labels?: BookingLabels
}

type Grouped = { section: string; rows: Array<{ row: string; seats: Seat[] }> }

function group(seats: Seat[]): Grouped[] {
  const sections = new Map<string, Map<string, Seat[]>>()
  for (const seat of seats) {
    const rows = sections.get(seat.section) ?? new Map<string, Seat[]>()
    rows.set(seat.row, [...(rows.get(seat.row) ?? []), seat])
    sections.set(seat.section, rows)
  }
  return [...sections.entries()]
    .sort(([a], [b]) => naturalCompare(a, b))
    .map(([section, rows]) => ({
      section,
      rows: [...rows.entries()]
        .sort(([a], [b]) => naturalCompare(a, b))
        .map(([row, list]) => ({ row, seats: [...list].sort((a, b) => a.number - b.number) })),
    }))
}

/**
 * 좌석 배치도 - 구역 → 열 → 번호 격자. 세 상태(선택 가능 · 내 자리 · 선택 불가)를 색만이 아니라 글자(단추 이름)로도 말한다.
 * 누르면 `onPick` - 잡기인지 놓기인지는 부르는 쪽(보류 컨트롤러)이 정한다. 확대 · 축소 · 그림 편집은 없다.
 */
export function SeatMap({
  seats,
  mineIds = [],
  pendingIds = [],
  pickTaken = false,
  disabled = false,
  loaded = true,
  connection = 'live',
  currency,
  locale,
  onPick,
  labels = defaultBookingLabels,
}: SeatMapProps) {
  const L = labels.map
  const mine = useMemo(() => new Set(mineIds), [mineIds])
  const pending = useMemo(() => new Set(pendingIds), [pendingIds])
  const grouped = useMemo(() => group(seats), [seats])
  const grades = useMemo(
    () => [...new Set(seats.map((seat) => seat.grade))].sort(naturalCompare),
    [seats],
  )
  const gradeIndex = (grade: string) => grades.indexOf(grade) % 4

  if (!loaded) return <p role="status">{L.loading}</p>
  return (
    <div className={styles.map}>
      {connection === 'reconnecting' && <Alert tone="warning">{L.reconnecting}</Alert>}
      {seats.length === 0 ? (
        <p>{L.empty}</p>
      ) : (
        <>
          <ul className={styles.legend} aria-label={L.legendTitle}>
            {grades.map((grade) => (
              <li key={grade} className={styles.legendItem}>
                <span className={styles.swatch} data-grade={gradeIndex(grade)} aria-hidden="true" />
                {grade}
              </li>
            ))}
            <li className={styles.legendItem}>
              <span className={styles.swatch} data-state="mine" aria-hidden="true" />
              {L.states.mine}
            </li>
            <li className={styles.legendItem}>
              <span className={styles.swatch} data-state="taken" aria-hidden="true" />
              {L.states.taken}
            </li>
          </ul>
          {grouped.map(({ section, rows }) => (
            <section key={section} className={styles.section} aria-label={L.section(section)}>
              <h3 className={styles.sectionTitle}>{L.section(section)}</h3>
              {rows.map(({ row, seats: rowSeats }) => (
                <div key={row} role="group" aria-label={L.row(row)} className={styles.row}>
                  <span className={styles.rowLabel} aria-hidden="true">
                    {L.row(row)}
                  </span>
                  {rowSeats.map((seat) => {
                    const own = mine.has(seat.id)
                    const state = own ? 'mine' : seat.state === 'TAKEN' ? 'taken' : 'open'
                    return (
                      <button
                        key={seat.id}
                        type="button"
                        className={styles.seat}
                        data-state={state}
                        data-grade={gradeIndex(seat.grade)}
                        aria-pressed={own}
                        aria-label={L.seat({
                          section: seat.section,
                          row: seat.row,
                          number: seat.number,
                          grade: seat.grade,
                          price:
                            seat.price === undefined
                              ? undefined
                              : formatMoney(seat.price, currency, locale),
                          stateName: L.states[state],
                        })}
                        disabled={
                          disabled || (state === 'taken' && !pickTaken) || pending.has(seat.id)
                        }
                        aria-busy={pending.has(seat.id) || undefined}
                        onClick={() => onPick(seat.id)}
                      >
                        {seat.number}
                      </button>
                    )
                  })}
                </div>
              ))}
            </section>
          ))}
        </>
      )}
    </div>
  )
}
