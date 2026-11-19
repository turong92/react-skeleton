import { Alert, Button, Dialog, Field, Input, Stat } from '@skeleton/ui'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import type { WaitingRoomAdminApi } from './adminApi'
import { defaultWaitingRoomAdminLabels, type WaitingRoomAdminLabels } from './labels'
import styles from './AdminWaitingRoom.module.css'

export type AdminWaitingRoomProps = {
  api: Pick<WaitingRoomAdminApi, 'stats' | 'setRate' | 'close'>
  roomId: string
  labels?: WaitingRoomAdminLabels
}

/** 현황을 새로 읽는 간격 - 운영 화면이 열려 있는 동안만(탭이 숨으면 TanStack Query 가 멈춘다) */
const REFRESH_MS = 5000

/** 대기실 운영 - 숫자 현황(5초마다) · 속도 바꾸기 · 멈춤 / 다시 시작 · 닫기(확인 창). 권한 검사는 서버 몫이고 화면 숨김은 앱의 라우트가 한다 */
export function AdminWaitingRoom({
  api,
  roomId,
  labels = defaultWaitingRoomAdminLabels,
}: AdminWaitingRoomProps) {
  const [typed, setTyped] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [closed, setClosed] = useState(false)
  const stats = useQuery({
    queryKey: ['waiting-room-admin', roomId, 'stats'],
    queryFn: () => api.stats(roomId),
    refetchInterval: REFRESH_MS,
  })
  const rate = useMutation({
    mutationFn: (perMinute: number) => api.setRate(roomId, perMinute),
    onSuccess: () => stats.refetch(),
  })
  const close = useMutation({
    mutationFn: () => api.close(roomId),
    onSuccess: () => {
      setConfirmClose(false)
      setClosed(true)
      void stats.refetch()
    },
  })

  const L = labels
  const current = stats.data
  const text = typed ?? (current && current.perMinute > 0 ? String(current.perMinute) : '')
  const parsed = /^\d+$/.test(text.trim()) ? Number(text.trim()) : NaN
  const valid = Number.isInteger(parsed) && parsed >= 1
  const paused = current !== undefined && current.perMinute === 0
  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (valid && !rate.isPending) rate.mutate(parsed)
  }

  return (
    <section className={styles.root} aria-label={L.title}>
      <h2 className={styles.title}>{L.title}</h2>
      {stats.isError && <Alert tone="danger">{L.loadFailed}</Alert>}
      {current && (
        <div className={styles.stats}>
          <Stat label={L.stats.prequeue} value={current.prequeue} />
          <Stat label={L.stats.issued} value={current.issued} />
          <Stat label={L.stats.serving} value={current.serving} />
          <Stat
            label={L.stats.perMinute}
            value={paused ? L.stats.paused : current.perMinute}
            tone={paused ? 'warning' : 'neutral'}
          />
          <Stat
            label={L.stats.drain}
            value={
              current.estimatedDrainSeconds === null
                ? '-'
                : L.stats.minutes(current.estimatedDrainSeconds)
            }
          />
        </div>
      )}
      {closed ? (
        <Alert tone="info">{L.close.done}</Alert>
      ) : (
        <>
          <form className={styles.rate} onSubmit={onSubmit} noValidate>
            <Field
              label={L.rate.label}
              hint={L.rate.hint}
              error={typed !== null && !valid ? L.rate.invalid : undefined}
            >
              {(control) => (
                <Input
                  {...control}
                  type="text"
                  inputMode="numeric"
                  value={text}
                  onChange={(event) => setTyped(event.target.value)}
                />
              )}
            </Field>
            <div className={styles.actions}>
              {paused ? (
                <Button type="submit" disabled={!valid} loading={rate.isPending}>
                  {L.rate.resume}
                </Button>
              ) : (
                <>
                  <Button type="submit" disabled={!valid} loading={rate.isPending}>
                    {L.rate.apply}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={current === undefined}
                    onClick={() => rate.mutate(0)}
                  >
                    {L.rate.pause}
                  </Button>
                </>
              )}
            </div>
          </form>
          {(rate.isError || close.isError) && <Alert tone="danger">{L.actionFailed}</Alert>}
          <div className={styles.actions}>
            <Button variant="danger" onClick={() => setConfirmClose(true)}>
              {L.close.open}
            </Button>
          </div>
          <Dialog
            open={confirmClose}
            onClose={() => setConfirmClose(false)}
            title={L.close.title}
            footer={
              <>
                <Button variant="secondary" onClick={() => setConfirmClose(false)}>
                  {L.close.cancel}
                </Button>
                <Button variant="danger" loading={close.isPending} onClick={() => close.mutate()}>
                  {L.close.confirm}
                </Button>
              </>
            }
          >
            <p>{L.close.body}</p>
          </Dialog>
        </>
      )}
    </section>
  )
}
