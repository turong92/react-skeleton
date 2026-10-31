import { ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { formatInstant } from '@skeleton/time'
import { Alert, Button, Spinner, SwitchRow, Table } from '@skeleton/ui'
import { useMutationState } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import {
  usePush,
  usePushConfig,
  usePushDevices,
  usePushPreferences,
  useRemovePushDevice,
  useSetPushPreference,
  type PushOptions,
} from './hooks'
import { resolvePushLabels, type PushLabelsInput } from './labels'
import type { PushApi } from './pushApi'
import { pushKeys } from './queries'
import styles from './PushSettings.module.css'

export type PushSettingsProps = PushOptions & {
  api: PushApi
  labels?: PushLabelsInput
  /** 시각 글자(기본 `@skeleton/time` 의 `formatInstant`) */
  formatTime?: (iso: string) => string
  /** 종류 목록 위 제목을 바꾸고 싶을 때(기본은 문구 모음의 `types.title`) */
  typesTitle?: ReactNode
}

type TestState = 'idle' | 'sending' | 'sent' | 'tooSoon' | 'failed'

/**
 * 설정 칸 — 이 기기에서 푸시 받기 스위치(권한 거절 · 홈 화면 추가 필요 · 미지원이면 까닭 안내) + 시험 알림 + 내 다른 기기 표
 * + 종류별 푸시 스위치(`GET /preferences` 의 종류마다, 「모든 채널 끄기」를 켠 종류는 잠긴다. 광고 종류는 여기 없다).
 * 카드 안에 넣는다 — 카드가 큰 제목을 맡는다.
 */
export function PushSettings({
  api,
  labels,
  formatTime = (iso) => formatInstant(iso),
  typesTitle,
  ...options
}: PushSettingsProps) {
  const text = useMemo(() => resolvePushLabels(labels), [labels])
  const s = text.settings
  const push = usePush(api, options)
  const config = usePushConfig(api)
  const devices = usePushDevices(api)
  const preferences = usePushPreferences(api)
  const removeDevice = useRemovePushDevice(api)
  const savePreference = useSetPushPreference(api)
  const [test, setTest] = useState<TestState>('idle')
  const saving = new Set(
    useMutationState({
      filters: { mutationKey: pushKeys.setPreference(), status: 'pending' },
      select: (mutation) => (mutation.state.variables as { type: string }).type,
    }),
  )

  if (push.support === null || config.isPending) return <Spinner label={text.loading} />
  if (config.isError)
    return (
      <Alert
        tone="danger"
        action={
          <Button
            variant="secondary"
            size="sm"
            loading={config.isFetching}
            onClick={() => void config.refetch()}
          >
            {text.retry}
          </Button>
        }
      >
        {text.loadFailed}
      </Alert>
    )

  const sendTest = async () => {
    setTest('sending')
    try {
      await push.sendTest()
      setTest('sent')
    } catch (error) {
      setTest(isErrorCode(error, ErrorCodes.PUSH_TEST_TOO_SOON) ? 'tooSoon' : 'failed')
    }
  }

  const blocker =
    push.support === 'needs-install'
      ? { tone: 'info' as const, ...s.needsInstall }
      : push.support === 'unsupported'
        ? { tone: 'info' as const, ...s.unsupported }
        : config.data.webPush === null
          ? { tone: 'info' as const, ...s.notConfigured }
          : push.permission === 'denied'
            ? { tone: 'warning' as const, ...s.denied }
            : null

  const others = (devices.data ?? []).filter((d) => d.installationId !== push.installationId)
  const deviceName = (kind: 'WEBPUSH' | 'FCM', label: string | null) =>
    label ?? s.devices.kind[kind]
  const items = preferences.data ?? []
  const typeName = (type: string) => s.types.names[type] ?? type

  return (
    <div className={styles.root}>
      <div className={styles.section}>
        {blocker ? (
          <Alert tone={blocker.tone} title={blocker.title}>
            {blocker.description}
          </Alert>
        ) : (
          <>
            <SwitchRow
              title={s.switchTitle}
              description={s.switchDescription}
              checked={push.enabled}
              busy={push.busy}
              onChange={(on) => void (on ? push.enable() : push.disable())}
            />
            {push.failed && (
              <Alert tone="danger">
                {push.failed === 'enable' ? s.enableFailed : s.disableFailed}
              </Alert>
            )}
            {push.enabled && (
              <div className={styles.actions}>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={test === 'sending'}
                  onClick={() => void sendTest()}
                >
                  {s.test.action}
                </Button>
                {test === 'sent' && (
                  <span role="status" className={styles.hint}>
                    {s.test.sent}
                  </span>
                )}
                {(test === 'tooSoon' || test === 'failed') && (
                  <span role="alert" className={styles.hint}>
                    {test === 'tooSoon' ? s.test.tooSoon : s.test.failed}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {(others.length > 0 || push.support === 'supported') && (
        <div className={styles.section}>
          <h3 className={styles.heading}>{s.devices.title}</h3>
          {removeDevice.isError && <Alert tone="danger">{s.devices.removeFailed}</Alert>}
          <Table
            caption={s.devices.caption}
            rows={others}
            rowKey={(d) => d.installationId}
            empty={<span className={styles.hint}>{s.devices.empty}</span>}
            columns={[
              {
                key: 'name',
                header: s.devices.columnName,
                rowHeader: true,
                render: (d) => deviceName(d.kind, d.label),
              },
              {
                key: 'lastSeen',
                header: s.devices.columnLastSeen,
                render: (d) => formatTime(d.lastSeenAt),
              },
              {
                key: 'actions',
                header: s.devices.columnActions,
                align: 'end',
                render: (d) => (
                  <Button
                    variant="danger"
                    size="sm"
                    aria-label={s.devices.removeFor(deviceName(d.kind, d.label))}
                    loading={removeDevice.isPending && removeDevice.variables === d.installationId}
                    onClick={() => removeDevice.mutate(d.installationId)}
                  >
                    {s.devices.remove}
                  </Button>
                ),
              },
            ]}
          />
        </div>
      )}

      <div className={styles.section}>
        <h3 className={styles.heading}>{typesTitle ?? s.types.title}</h3>
        <p className={styles.hint}>{s.types.description}</p>
        {savePreference.isError && <Alert tone="danger">{s.types.saveFailed}</Alert>}
        {preferences.isPending ? (
          <Spinner label={text.loading} />
        ) : preferences.isError && !preferences.data ? (
          <Alert
            tone="danger"
            action={
              <Button
                variant="secondary"
                size="sm"
                loading={preferences.isFetching}
                onClick={() => void preferences.refetch()}
              >
                {text.retry}
              </Button>
            }
          >
            {text.loadFailed}
          </Alert>
        ) : items.length === 0 ? (
          <p className={styles.hint}>{s.types.empty}</p>
        ) : (
          <div className={styles.list}>
            {items.map((item) => (
              <SwitchRow
                key={item.type}
                title={typeName(item.type)}
                description={item.allChannelsMuted ? s.types.allMuted : undefined}
                checked={item.push && !item.allChannelsMuted}
                disabled={item.allChannelsMuted}
                busy={saving.has(item.type)}
                onChange={(enabled) => savePreference.mutate({ type: item.type, enabled })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
