import { isErrorCode } from '@skeleton/api-client'
import { Button, FilePicker, Progress } from '@skeleton/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { defaultVideoUploadLabels, type VideoUploadLabels } from './labels'
import type { PartPut } from './putPart'
import type { VideoItem, VideoVisibility } from './types'
import { UnsupportedVideoFileError, uploadVideo, UploadPartError } from './uploadVideo'
import { useVideos, videosKey } from './useVideos'
import type { VideoApi } from './videoApi'
import styles from './VideoUploadField.module.css'
import { failReasonKey, formatDuration, phaseOf } from './videoView'

export type VideoUploadFieldProps = {
  api: VideoApi
  /** 이 칸이 다루는 영상의 목적(예: `clip`) - 목록도 이 목적으로 읽는다 */
  purpose: string
  /** 공개 / 비공개(기본 비공개) - 영상마다 앱이 정해 넘긴다 */
  visibility?: VideoVisibility
  /** 최대 개수(기본 1) - 닿으면 고르기가 막힌다 */
  max?: number
  /** 이어 올리기(기본 켬) - 새로 고침한 뒤 같은 파일을 다시 고르면 빠진 조각만 올린다 */
  resume?: boolean
  /** 이 목적의 영상 가운데 이 칸이 보이고 세는(`max`) 줄을 고른다(기본 전부) - 영상을 글마다 하나씩 붙이는 화면이 자기 것만 보이게 */
  include?: (video: VideoItem) => boolean
  /** 올리기를 마친 직후(목록을 다시 읽기 전) - 앱이 그 영상을 자기 데이터에 붙인다. 던지면 그 줄은 실패로 보인다 */
  onUploaded?: (video: VideoItem) => void | Promise<void>
  labels?: VideoUploadLabels
  /** 시험 · 스토리용 - 조각 `PUT` (기본은 XHR) */
  put?: PartPut
  /** 시험 · 스토리용 - 만드는 중일 때 목록을 다시 읽는 간격(기본 3000ms) */
  pollMs?: number
}

/** `problem` 이 있으면 실패한 줄. `completed` 가 있으면 올리기는 끝났고 앱의 `onUploaded` 만 실패한 줄(영상이 서버에 완성돼 있다) */
type Upload = {
  id: number
  file: File
  sent: number
  videoId?: string
  problem?: string
  network?: boolean
  completed?: VideoItem
}

const sameFile = (a: File, b: File) =>
  a.name === b.name && a.size === b.size && a.lastModified === b.lastModified

/** 올리기 오류 → 문구. 서버 코드는 원 서비스의 `VIDEO.*` 를 따른다 */
function problemOf(error: unknown, labels: VideoUploadLabels): string {
  if (error instanceof UnsupportedVideoFileError) return labels.errors.unsupportedFile
  if (error instanceof UploadPartError) return labels.errors.network
  if (isErrorCode(error, ['VIDEO.UNSUPPORTED'])) return labels.errors.unsupportedFile
  if (isErrorCode(error, ['VIDEO.TOO_LARGE'])) return labels.errors.tooLarge
  if (isErrorCode(error, ['VIDEO.QUOTA'])) return labels.errors.quota
  return labels.errors.failed
}

/**
 * 영상 올리기 칸 - 파일 고르기(`FilePicker`) + 올리는 중 % → 서버가 준비 중 n% → 재생 가능 → 「다른 기기용 판 준비 중」 → 끝,
 * 실패하면 서버가 붙인 사유 코드를 문구로, 올리다 만 줄은 안내, 줄마다 지우기. 목록은 `useVideos`(만드는 중이면 3초 폴링)이고
 * 파일 바이트는 서버를 지나지 않고 저장소로 직접 간다. `QueryClientProvider` 안에서 쓴다
 */
export function VideoUploadField({
  api,
  purpose,
  visibility = 'PRIVATE',
  max = 1,
  resume = true,
  include,
  onUploaded,
  labels = defaultVideoUploadLabels,
  put,
  pollMs,
}: VideoUploadFieldProps) {
  const queryClient = useQueryClient()
  const { data } = useVideos(api, purpose, { pollMs })
  const [uploads, setUploads] = useState<Upload[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const controllers = useRef(new Map<number, AbortController>())
  const nextId = useRef(0)

  useEffect(() => {
    const running = controllers.current
    // 화면을 떠나면 올리기만 멈춘다 - 서버 쪽 올리기는 남겨 두어 같은 파일을 다시 고르면 이어진다
    return () => running.forEach((controller) => controller.abort())
  }, [])

  const refresh = () => queryClient.invalidateQueries({ queryKey: videosKey(purpose) })
  const patch = (id: number, change: Partial<Upload>) =>
    setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...change } : u)))
  const drop = (id: number) => setUploads((list) => list.filter((u) => u.id !== id))

  const liveIds = new Set(uploads.flatMap((u) => (u.videoId ? [u.videoId] : [])))
  const shown = (data ?? []).filter(
    (video) => video.status !== 'DELETED' && !liveIds.has(video.id) && (include?.(video) ?? true),
  )
  // 올리다 만 줄 · 멈춘 줄은 자리를 차지하지 않는다 - 같은 파일을 다시 골라 이어 올릴 수 있어야 한다
  const taken =
    shown.filter((video) => phaseOf(video, false).phase !== 'abandoned').length +
    uploads.filter((u) => !u.problem || u.completed).length
  const full = taken >= max

  const start = (file: File) => {
    const id = nextId.current++
    const controller = new AbortController()
    controllers.current.set(id, controller)
    setNotice(null)
    // 같은 파일을 다시 고르거나 「다시 시도」 하면 멈춰 있던 그 줄을 대신한다
    setUploads((list) => [
      ...list.filter((u) => !(u.problem && !u.completed && sameFile(u.file, file))),
      { id, file, sent: 0 },
    ])
    uploadVideo(api, file, {
      purpose,
      visibility,
      resume,
      put,
      signal: controller.signal,
      onProgress: (sent) => patch(id, { sent }),
      onStarted: (videoId) => patch(id, { videoId }),
    })
      .then((video) => settle(id, video))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return drop(id)
        patch(id, { problem: problemOf(error, labels), network: error instanceof UploadPartError })
      })
      .finally(() => controllers.current.delete(id))
  }

  // 올리기가 끝난 영상을 앱에 맡긴다. 앱이 못 받으면 영상은 서버에 완성돼 있으니 그 줄에 「다시 붙이기」 · 「지우기」 를 남긴다
  const settle = async (id: number, video: VideoItem) => {
    try {
      await onUploaded?.(video)
      await refresh()
      drop(id)
    } catch {
      patch(id, { completed: video, videoId: video.id, problem: labels.errors.attachFailed })
    }
  }

  const onFiles = (files: File[]) => {
    files.slice(0, Math.max(0, max - taken)).forEach(start)
  }

  const cancel = (upload: Upload) => {
    controllers.current.get(upload.id)?.abort()
    drop(upload.id)
    if (upload.videoId) api.remove(upload.videoId).then(refresh, () => {})
  }

  // 멈춘 줄 지우기 - 서버에 영상이 있으면 함께 지운다(다시 시도는 서버를 지우지 않는다)
  const discard = (upload: Upload) => {
    drop(upload.id)
    if (upload.videoId)
      api.remove(upload.videoId).then(refresh, () => setNotice(labels.errors.removeFailed))
  }

  const remove = (video: VideoItem) => {
    setNotice(null)
    api.remove(video.id).then(refresh, () => setNotice(labels.errors.removeFailed))
  }

  return (
    <div className={styles.root}>
      <FilePicker
        title={labels.title}
        hint={labels.hint}
        buttonLabel={labels.chooseButton}
        accept="video/mp4,video/quicktime,.mp4,.mov"
        disabled={full}
        onFiles={onFiles}
      />
      {(shown.length > 0 || uploads.length > 0) && (
        <ul className={styles.list}>
          {shown.map((video, index) => (
            <VideoRow
              key={video.id}
              video={video}
              name={labels.videoName(index + 1)}
              labels={labels}
              onRemove={() => remove(video)}
            />
          ))}
          {uploads.map((upload) => {
            const percent = Math.min(
              100,
              Math.floor((upload.sent / Math.max(1, upload.file.size)) * 100),
            )
            return (
              <li
                key={`upload-${upload.id}`}
                className={styles.item}
                data-state={upload.problem ? 'failed' : 'uploading'}
              >
                <p className={styles.name}>{upload.file.name}</p>
                {!upload.problem && (
                  <Progress
                    label={labels.uploading(upload.file.name)}
                    value={percent / 100}
                    valueText={`${percent}%`}
                  />
                )}
                {upload.problem && (
                  <p role="alert" className={styles.problem}>
                    {upload.problem}
                  </p>
                )}
                {upload.problem ? (
                  <div className={styles.actions}>
                    {(upload.network || upload.completed) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={
                          upload.completed
                            ? labels.reattachNamed(upload.file.name)
                            : labels.retryNamed(upload.file.name)
                        }
                        onClick={() =>
                          upload.completed
                            ? void settle(upload.id, upload.completed)
                            : start(upload.file)
                        }
                      >
                        {upload.completed ? labels.reattach : labels.retry}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={labels.removeNamed(upload.file.name)}
                      onClick={() => discard(upload)}
                    >
                      {labels.remove}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={labels.cancelNamed(upload.file.name)}
                    onClick={() => cancel(upload)}
                  >
                    {labels.cancel}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {notice && (
        <p role="alert" className={styles.problem}>
          {notice}
        </p>
      )}
      {full && <p className={styles.limit}>{labels.limitReached(max)}</p>}
    </div>
  )
}

function VideoRow({
  video,
  name,
  labels,
  onRemove,
}: {
  video: VideoItem
  name: string
  labels: VideoUploadLabels
  onRemove: () => void
}) {
  const view = phaseOf(video, false)
  const meta = [
    video.durationMs ? formatDuration(video.durationMs) : null,
    video.width && video.height ? `${video.width}×${video.height}` : null,
  ].filter(Boolean)
  return (
    <li className={styles.item} data-phase={view.phase}>
      <p className={styles.name}>{name}</p>
      {meta.length > 0 && <p className={styles.meta}>{meta.join(' · ')}</p>}
      {view.phase === 'processing' && (
        <>
          <p className={styles.status} data-phase="processing">
            {view.percent !== null ? labels.processingPercent(view.percent) : labels.processing}
          </p>
          {view.percent !== null && (
            <Progress label={labels.processingBar(name)} value={view.percent / 100} />
          )}
        </>
      )}
      {(view.phase === 'ready' || view.phase === 'extras') && (
        <p className={styles.status} data-phase="ready">
          {labels.ready}
        </p>
      )}
      {view.phase === 'extras' && <p className={styles.meta}>{labels.extras}</p>}
      {view.phase === 'failed' && (
        <p role="alert" className={styles.problem}>
          {labels.failReasons[failReasonKey(view.failCode)]}
        </p>
      )}
      {view.phase === 'abandoned' && <p className={styles.meta}>{labels.abandoned}</p>}
      <Button variant="ghost" size="sm" aria-label={labels.removeNamed(name)} onClick={onRemove}>
        {labels.remove}
      </Button>
    </li>
  )
}
