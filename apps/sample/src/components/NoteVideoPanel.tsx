import {
  koVideoPlayerLabels,
  koVideoUploadLabels,
  defaultVideoPlayerLabels,
  defaultVideoUploadLabels,
  useVideos,
  VideoPlayer,
  VideoUploadField,
  type VideoApi,
} from '@skeleton/video'
import { Card, Spinner } from '@skeleton/ui'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { languageOf, useT } from '../i18n'
import { noteInputOf } from '../notes/noteInput'
import { useUpdateNote } from '../notes/queries'
import type { Note } from '../notes/types'
import { NOTE_VIDEO_PURPOSE, videoApi } from '../notes/videoApi'
import styles from './NoteVideoPanel.module.css'

/** 재생 허가를 받아 틀어 준다. 비공개 토큰이 끝나면 `VideoPlayer` 가 `refreshGrant` 로 새 허가를 받아 같은 시각에서 잇는다 */
function NoteVideoPlayer({
  videoId,
  labels,
}: {
  videoId: string
  labels: typeof koVideoPlayerLabels
}) {
  const grant = useQuery({
    queryKey: ['note-video-grant', videoId],
    queryFn: () => videoApi.playback(videoId),
    staleTime: Infinity, // 허가를 마음대로 다시 받지 않는다 - 만료는 플레이어가 다룬다
    retry: false,
  })
  if (grant.isPending) return <Spinner />
  if (grant.isError) return null
  return (
    <div className={styles.player}>
      <VideoPlayer
        grant={grant.data}
        refreshGrant={() => videoApi.playback(videoId)}
        labels={labels}
      />
    </div>
  )
}

/**
 * 영상 — 노트마다 하나. 파일은 브라우저가 저장소로 직접 올리고(`@skeleton/video`), 올리기가 끝나면 그 영상 번호를 노트에 저장한다.
 * 지우기는 노트에서 떼는 것으로 한다(서버가 노트에서 떨어진 영상을 지운다). 재생 가능이 되면 플레이어가 뜬다.
 */
export function NoteVideoPanel({ note }: { note: Note }) {
  const { t, locale } = useT()
  const korean = languageOf(locale) === 'ko'
  const update = useUpdateNote(note.id)
  const videos = useVideos(videoApi, NOTE_VIDEO_PURPOSE)
  const mine = videos.data?.find((video) => video.id === note.videoId)

  // 칸의 「지우기」는 노트에서 떼는 일이다 - 서버가 영상을 지운다. 올리다 만 줄의 취소(노트에 안 붙은 영상)는 영상을 직접 지운다
  const api = useMemo<VideoApi>(
    () => ({
      ...videoApi,
      remove: (id: string) =>
        id === note.videoId
          ? update.mutateAsync(noteInputOf(note, { videoId: null })).then(() => undefined)
          : videoApi.remove(id),
    }),
    [note, update],
  )

  return (
    <Card title={t('video.title')}>
      <div className={styles.body}>
        <VideoUploadField
          api={api}
          purpose={NOTE_VIDEO_PURPOSE}
          visibility="PRIVATE"
          include={(video) => video.id === note.videoId}
          onUploaded={async (video) => {
            await update.mutateAsync(noteInputOf(note, { videoId: video.id }))
          }}
          labels={korean ? koVideoUploadLabels : defaultVideoUploadLabels}
        />
        {mine?.status === 'PLAYABLE' && (
          <NoteVideoPlayer
            videoId={mine.id}
            labels={korean ? koVideoPlayerLabels : defaultVideoPlayerLabels}
          />
        )}
      </div>
    </Card>
  )
}
