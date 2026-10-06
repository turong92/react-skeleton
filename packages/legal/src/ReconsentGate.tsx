import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import type { MarkdownFacts } from '@skeleton/ui'
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { pickDocuments, rowsFromMissing, type ConsentRow } from './consentLogic'
import { DocumentDialog } from './DocumentDialog'
import { useLegalDocuments } from './hooks'
import type { LegalLabels } from './labels'
import type { LegalApi } from './legalApi'
import { ReconsentScreen } from './ReconsentScreen'
import type { ReconsentController } from './reconsent'
import type { ConsentRequest } from './types'

export type ReconsentGateProps = {
  controller: ReconsentController
  api: LegalApi
  /** 로그인한 계정 id(없으면 null) — 바뀌어 생기면 한 번 `GET /consents/me` 를 확인한다(소셜 · 링크 · 비밀번호 로그인 모두 같은 길) */
  accountId: string | null
  /** 「로그아웃」 — 보통 `auth.logout()` */
  onLeave: () => void
  locale: string
  fallbackLocale?: string
  facts?: MarkdownFacts
  formatLocale?: string
  zone?: string
  labels?: Partial<LegalLabels>
  children: ReactNode
}

/**
 * 앱 맨 위(`QueryClientProvider` 안)에 한 번 둔다. 재동의가 필요하면(403 `LEGAL.RECONSENT_REQUIRED` 또는 로그인 직후 `blocked`) 아래를 `inert` 로 두고
 * 동의 화면을 덮는다 — 아래 화면은 그대로 살아 있어서(경로 · 입력 유지) 동의가 끝나면 막혔던 호출이 다시 나가 **가던 자리에서 이어진다**.
 */
export function ReconsentGate({
  controller,
  api,
  accountId,
  onLeave,
  locale,
  fallbackLocale,
  facts,
  formatLocale,
  zone,
  labels,
  children,
}: ReconsentGateProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
  const required = state.status === 'required'
  // 제목 · 언어를 쓰는 건 막이 열렸을 때뿐 — 열려 있지 않으면 묻지 않는다(legal 모듈이 없는 백엔드에 화면마다 묻지 않게)
  const documents = useLegalDocuments(api, { enabled: required })
  const [failure, setFailure] = useState<'stale' | 'failed' | null>(null)
  const [open, setOpen] = useState<ConsentRow | null>(null)

  useEffect(() => {
    if (accountId) void controller.check()
  }, [accountId, controller])
  // 로그아웃하면 묻던 것을 접는다(기다리던 호출은 403 으로 끝난다)
  useEffect(() => {
    if (!accountId && controller.getState().status === 'required') controller.decline()
  }, [accountId, controller])

  const rows = useMemo(
    () =>
      state.status === 'required'
        ? rowsFromMissing(
            state.missing,
            pickDocuments(documents.data ?? [], locale, fallbackLocale),
            locale,
          )
        : [],
    [state, documents.data, locale, fallbackLocale],
  )

  async function agree(consents: ConsentRequest[]) {
    setFailure(null)
    try {
      await controller.agree(consents)
    } catch (error) {
      setFailure(
        error instanceof ApiRequestError && error.apiError.code === ErrorCodes.LEGAL_VERSION_STALE
          ? 'stale'
          : 'failed',
      )
      throw error
    }
  }

  return (
    <>
      <div style={{ display: 'contents' }} inert={required}>
        {children}
      </div>
      {state.status === 'required' && (
        <>
          {/* 새 판으로 줄이 바뀌면 체크는 처음부터 — key 가 판 목록이다 */}
          <ReconsentScreen
            key={rows.map((r) => `${r.type}@${r.version}`).join(',')}
            rows={rows}
            // 모두 `NOT_AGREED` 면 처음 동의 — 어디서 알았는가(403 · 로그인 직후)보다 서버가 말한 이유가 정확하다
            firstSignIn={
              state.missing.length > 0 && state.missing.every((m) => m.reason === 'NOT_AGREED')
            }
            onAgree={agree}
            onLeave={() => {
              controller.decline()
              onLeave()
            }}
            onOpen={setOpen}
            failure={failure}
            labels={labels}
          />
          <DocumentDialog
            api={api}
            document={open}
            onClose={() => setOpen(null)}
            facts={facts}
            locale={formatLocale ?? locale}
            zone={zone}
            labels={labels}
          />
        </>
      )}
    </>
  )
}
