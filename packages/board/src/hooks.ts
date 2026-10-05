import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BoardApi } from './boardApi'
import {
  createCommentMutation,
  createPostMutation,
  moderateCommentMutation,
  moderatePostMutation,
  removeCommentMutation,
  removePostMutation,
  updateCommentMutation,
  updatePostMutation,
} from './mutations'
import {
  boardQuery,
  boardsQuery,
  commentListQuery,
  configQuery,
  postListQuery,
  postQuery,
} from './queries'
import { reactionMutationOptions } from './reactionMutation'
import type { BoardId, CommentListParams, PostListParams, ReactionMode } from './types'

/*
 * 얇은 훅 모음 — 읽기는 쿼리 정의(queries.ts), 쓰기는 옵션 함수(mutations.ts · reactionMutation.ts)를 그대로 쓴다.
 * 에러 표시는 앱의 QueryClient 전역 핸들러가 한다(이 패키지는 토스트를 모른다).
 */

const MINUTES = 60_000

/** 게시판 설정(반응 종류 · 한도 · 운영자 여부). 자주 바뀌지 않아 5분은 다시 가져오지 않는다 */
export function useBoardConfig(api: BoardApi) {
  return useQuery({ ...configQuery(api), staleTime: 5 * MINUTES })
}

export function useBoards(api: BoardApi) {
  return useQuery(boardsQuery(api))
}

export function useBoard(api: BoardApi, code: string) {
  return useQuery(boardQuery(api, code))
}

/** 글 목록 한 쪽 — 쪽 · 검색 · 정렬을 바꿀 때 이전 결과를 보여 주며 새로 가져온다 */
export function usePosts(api: BoardApi, code: string, params: PostListParams = {}) {
  return useQuery({ ...postListQuery(api, code, params), placeholderData: keepPreviousData })
}

/** 글 한 건 — 서버가 부를 때마다 조회수를 올리므로 창을 다시 눌러도 다시 가져오지 않는다 */
export function usePost(api: BoardApi, code: string, id: BoardId) {
  return useQuery({ ...postQuery(api, code, id), refetchOnWindowFocus: false })
}

export function useComments(
  api: BoardApi,
  code: string,
  postId: BoardId,
  params: CommentListParams = {},
) {
  return useQuery({
    ...commentListQuery(api, code, postId, params),
    placeholderData: keepPreviousData,
  })
}

export function useCreatePost(api: BoardApi, code: string) {
  const client = useQueryClient()
  return useMutation(createPostMutation(client, api, code))
}

export function useUpdatePost(api: BoardApi, code: string, id: BoardId) {
  const client = useQueryClient()
  return useMutation(updatePostMutation(client, api, code, id))
}

/** 운영자의 숨김 · 복구 · 고정 */
export function useModeratePost(api: BoardApi, code: string, id: BoardId) {
  const client = useQueryClient()
  return useMutation(moderatePostMutation(client, api, code, id))
}

export function useRemovePost(api: BoardApi, code: string) {
  const client = useQueryClient()
  return useMutation(removePostMutation(client, api, code))
}

export function useCreateComment(api: BoardApi, code: string, postId: BoardId) {
  const client = useQueryClient()
  return useMutation(createCommentMutation(client, api, code, postId))
}

export function useUpdateComment(api: BoardApi, code: string, postId: BoardId) {
  const client = useQueryClient()
  return useMutation(updateCommentMutation(client, api, code, postId))
}

export function useRemoveComment(api: BoardApi, code: string, postId: BoardId) {
  const client = useQueryClient()
  return useMutation(removeCommentMutation(client, api, code, postId))
}

export function useModerateComment(api: BoardApi, code: string, postId: BoardId) {
  const client = useQueryClient()
  return useMutation(moderateCommentMutation(client, api, code, postId))
}

/**
 * 글 · 댓글의 반응 누르기(낙관적 갱신 — 실패하면 되돌린다). `mutate({ target, type, active })` 의 `active` 는 누른 뒤의 상태.
 * `mode` 는 설정(`useBoardConfig`)의 `reactionMode`.
 */
export function useReaction(api: BoardApi, code: string, mode: ReactionMode) {
  const client = useQueryClient()
  return useMutation(reactionMutationOptions(client, api, code, mode))
}
