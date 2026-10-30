import { notificationKeys } from '@skeleton/notifications'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { useWorkspace } from '@skeleton/workspace'
import { notesApi } from './api'
import type { NotesApi } from './notesApi'
import type { NoteInput, NotesQuery } from './types'

/** 키는 `notes` 한 뿌리 아래(팀 노트는 `useWorkspace()` 의 id 로 칸이 갈린다) — 어느 변경이든 `invalidateNotes` 한 번이면 목록 · 상세 · 현황이 모두 다시 가져온다 */
export const notesKeys = {
  all: ['notes'] as const,
  /** 팀 노트(`workspaceId`)는 같은 뿌리 아래 팀 id 한 칸이 더 있다 — 내 노트 · 다른 팀 노트의 캐시와 섞이지 않는다 */
  list: (query: NotesQuery, workspaceId?: string) =>
    [...scopeOf(workspaceId), 'list', query] as const,
  detail: (id: string, workspaceId?: string) => [...scopeOf(workspaceId), 'detail', id] as const,
  summary: (workspaceId?: string) => [...scopeOf(workspaceId), 'summary'] as const,
}
function scopeOf(workspaceId?: string) {
  return workspaceId ? (['notes', workspaceId] as const) : (['notes'] as const)
}

/** 쿼리 정의(키 + 함수)를 훅과 따로 둔다 — 클라이언트만 바꿔 테스트한다(starter 의 `helloQuery` 모양) */
export const notesQuery = (api: NotesApi, query: NotesQuery, workspaceId?: string) => ({
  queryKey: notesKeys.list(query, workspaceId),
  queryFn: () => api.list(query),
})
export const noteQuery = (api: NotesApi, id: string, workspaceId?: string) => ({
  queryKey: notesKeys.detail(id, workspaceId),
  queryFn: () => api.get(id),
})
export const noteSummaryQuery = (api: NotesApi, workspaceId?: string) => ({
  queryKey: notesKeys.summary(workspaceId),
  queryFn: () => api.summary(),
})

export function invalidateNotes(client: QueryClient) {
  return client.invalidateQueries({ queryKey: notesKeys.all })
}

/** 목록 한 쪽. 쪽 · 검색을 바꿀 때 이전 결과를 보여 주며(깜빡임 없이) 새로 가져온다 */
export function useNotes(query: NotesQuery) {
  const workspaceId = useWorkspace()?.id
  return useQuery({
    ...notesQuery(notesApi, query, workspaceId),
    placeholderData: keepPreviousData,
  })
}

export function useNote(id: string) {
  return useQuery(noteQuery(notesApi, id, useWorkspace()?.id))
}

export function useNoteSummary() {
  return useQuery(noteSummaryQuery(notesApi))
}

/** 만들기 · 고치기 · 지우기는 성공하면 노트 쿼리를 모두 무효화한다. 백엔드가 알림도 발행하므로 알림도 다시 센다 */
function useAfterChange() {
  const client = useQueryClient()
  return () => {
    void invalidateNotes(client)
    void client.invalidateQueries({ queryKey: notificationKeys.all })
  }
}

export function useCreateNote() {
  const afterChange = useAfterChange()
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: NoteInput; idempotencyKey: string }) =>
      notesApi.create(input, idempotencyKey),
    onSuccess: afterChange,
  })
}

export function useUpdateNote(id: string) {
  const afterChange = useAfterChange()
  return useMutation({
    mutationFn: (input: NoteInput) => notesApi.update(id, input),
    onSuccess: afterChange,
  })
}

export function useDeleteNote() {
  const afterChange = useAfterChange()
  return useMutation({
    mutationFn: (id: string) => notesApi.remove(id),
    onSuccess: afterChange,
  })
}

export function useExportNote() {
  return useMutation({ mutationFn: (id: string) => notesApi.startExport(id) })
}
