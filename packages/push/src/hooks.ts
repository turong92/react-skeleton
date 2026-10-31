import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { getInstallationId } from './installationId'
import {
  browserPushEnv,
  disablePush,
  enablePush,
  isPushEnabled,
  syncPush,
  type EnableResult,
  type PushDeps,
  type PushEnv,
} from './pushClient'
import type { PushApi } from './pushApi'
import { configQuery, devicesQuery, preferencesQuery, pushKeys } from './queries'
import { browserPushStorage, type PushStorage } from './storage'
import type { PushPreference, PushSupport } from './types'

export type PushOptions = {
  /** 로그인한 계정 — 켬 표시를 계정별로 저장한다(다른 사람이 같은 브라우저에서 로그인해도 자동으로 켜지지 않는다) */
  accountId: string
  /** 서비스 워커 주소(`pushServiceWorker` 플러그인이 내는 파일, 기본 `/push-sw.js` — `base` 를 쓰는 앱은 맞춰 준다) */
  serviceWorkerUrl?: string
  /** 서버의 「내 기기」 표에 보일 이름 */
  deviceLabel?: string
  /** 브라우저 대신 쓸 환경 · 저장소(시험 · 스토리) */
  env?: PushEnv
  storage?: PushStorage
}

/** 창이 다시 보일 때 알린다(`useSyncExternalStore` 의 구독) */
function onVisible(notify: () => void) {
  const listener = () => document.visibilityState === 'visible' && notify()
  document.addEventListener('visibilitychange', listener)
  return () => document.removeEventListener('visibilitychange', listener)
}

function useDeps(api: PushApi, options: PushOptions) {
  const { accountId, serviceWorkerUrl = '/push-sw.js', deviceLabel, env, storage } = options
  return useMemo<PushDeps>(
    () => ({
      api,
      accountId,
      label: deviceLabel,
      env: env ?? browserPushEnv({ serviceWorkerUrl }),
      storage: storage ?? browserPushStorage(),
    }),
    [api, accountId, deviceLabel, env, serviceWorkerUrl, storage],
  )
}

export type UsePush = {
  /** 브라우저를 재기 전(서버 렌더 · 첫 그림)에는 null */
  support: PushSupport | null
  permission: NotificationPermission | null
  /** 이 계정이 이 브라우저에서 푸시를 켰다 */
  enabled: boolean
  /** 이 기기의 id — 내 기기 표에서 「이 기기」를 가린다 */
  installationId: string | null
  /** 켜는 중 · 끄는 중 */
  busy: boolean
  /** 마지막 켜기 · 끄기가 실패했다 */
  failed: 'enable' | 'disable' | null
  /**
   * 켠다 — **사용자의 클릭 처리기 안에서만** 부른다(`onClick={() => void enable()}`).
   * 권한 → 구독 → 서버 등록 순서이고, 여기 말고 자동으로 권한을 묻는 곳은 없다.
   */
  enable(): Promise<EnableResult | 'failed'>
  disable(): Promise<boolean>
  /** 이 기기로 시험 알림 하나 — 429 `PUSH.TEST_TOO_SOON` 은 그대로 던진다 */
  sendTest(): Promise<void>
}

/** 이 기기의 푸시 켜기 · 끄기 · 상태. 서버 렌더에서는 브라우저를 건드리지 않는다 */
export function usePush(api: PushApi, options: PushOptions): UsePush {
  const deps = useDeps(api, options)
  const client = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<'enable' | 'disable' | null>(null)
  // 브라우저 상태는 렌더 때 다시 읽는다 — 서버 렌더와 첫 그림은 「모름」이고, 창이 다시 보일 때(브라우저 설정에서 권한을 바꾸고 돌아온 경우)와
  // 켜기 · 끄기가 끝났을 때 다시 그린다. 값이 문자열이라 바뀌지 않았으면 다시 그리지 않는다
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const raw = useSyncExternalStore(
    onVisible,
    () => {
      const support = deps.env.support()
      return [
        support,
        support === 'supported' ? deps.env.permission() : 'default',
        isPushEnabled(deps.storage, deps.accountId) ? 'on' : 'off',
        getInstallationId(deps.storage),
      ].join('|')
    },
    () => '',
  )
  const [support, permission, enabled, installationId] = raw ? raw.split('|') : []

  const run = async <T>(kind: 'enable' | 'disable', action: () => Promise<T>) => {
    setBusy(true)
    setFailed(null)
    try {
      return await action()
    } catch {
      setFailed(kind)
      return 'failed' as const
    } finally {
      setBusy(false)
      rerender()
      void client.invalidateQueries({ queryKey: pushKeys.devices() })
    }
  }

  return {
    support: (support as PushSupport | undefined) ?? null,
    permission: (permission as NotificationPermission | undefined) ?? null,
    enabled: enabled === 'on',
    installationId: installationId ?? null,
    busy,
    failed,
    enable: () => run('enable', () => enablePush(deps)),
    disable: async () => (await run('disable', () => disablePush(deps))) !== 'failed',
    sendTest: () => api.sendTest(getInstallationId(deps.storage)),
  }
}

/**
 * 로그인한 화면에서 한 번 건다 — 로그인 뒤와 창이 다시 보일 때 서버와 브라우저를 맞춘다
 * (구독이 없거나 공개 키가 다르면 다시 구독 · 등록해 `last_seen_at` 도 갱신, 권한이 거절로 바뀌었으면 서버의 기기를 지운다).
 * **권한을 묻지 않는다.** 실패는 조용히 넘어가고 다음 기회에 다시 맞춘다.
 */
export function usePushSync(api: PushApi, options: PushOptions): void {
  const deps = useDeps(api, options)
  const client = useQueryClient()
  const running = useRef(false)

  useEffect(() => {
    const sync = async () => {
      if (running.current) return
      running.current = true
      try {
        if ((await syncPush(deps)) === 'revoked')
          void client.invalidateQueries({ queryKey: pushKeys.devices() })
      } catch {
        // 다음 기회에 다시
      } finally {
        running.current = false
      }
    }
    void sync()
    const onVisible = () => document.visibilityState === 'visible' && void sync()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [deps, client])
}

export const usePushConfig = (api: PushApi) => useQuery(configQuery(api))
export const usePushDevices = (api: PushApi) => useQuery(devicesQuery(api))
export const usePushPreferences = (api: PushApi) => useQuery(preferencesQuery(api))

/** 기기 하나 지우기 — 성공하면 목록을 다시 읽는다 */
export function useRemovePushDevice(api: PushApi) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (installationId: string) => api.removeDevice(installationId),
    onSuccess: () => client.invalidateQueries({ queryKey: pushKeys.devices() }),
  })
}

/** 한 종류의 푸시 끄기/켜기 — 성공하면 서버가 돌려준 값으로 캐시를 고친다 */
export function useSetPushPreference(api: PushApi) {
  const client = useQueryClient()
  return useMutation({
    mutationKey: pushKeys.setPreference(),
    mutationFn: ({ type, enabled }: { type: string; enabled: boolean }) =>
      api.setPreference(type, enabled),
    onSuccess: (saved: PushPreference) =>
      client.setQueryData<PushPreference[]>(pushKeys.preferences(), (items) =>
        items?.map((item) => (item.type === saved.type ? saved : item)),
      ),
  })
}
