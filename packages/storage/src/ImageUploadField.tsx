import { Button, FilePicker, Progress } from '@skeleton/ui'
import { useEffect, useRef, useState } from 'react'
import { StorageValidationError, UploadAbortedError, UploadRejectedError } from './errors'
import { defaultImageUploadLabels, type ImageUploadLabels } from './imageUploadLabels'
import styles from './ImageUploadField.module.css'
import type { ImageInspection, ImageStatus, StorageApi, StoredImageItem } from './storageApi'
import { StoredImage } from './StoredImage'
import type { Uploader } from './uploader'
import { useFilePreview } from './useFilePreview'

export type ImageUploadFieldProps = {
  /** 올리는 쪽 — `complete: true` 로 만들면 「처리 중」·서버 거절 문구가 나온다 */
  uploader: Uploader
  /** 있으면 이미 붙은 키(`value`)를 `api.images` 의 썸네일로 그린다 */
  api?: Pick<StorageApi, 'images'>
  /** 올라간 객체 키들(순서 = 보이는 순서) */
  value: string[]
  onChange: (keys: string[]) => void
  /** 최대 장수(기본 10) — 닿으면 고르기가 막힌다 */
  max?: number
  /** `<input accept>`(기본 `image/*`) */
  accept?: string
  labels?: ImageUploadLabels
}

type Upload = { id: number; file: File; fraction: number; problem?: string }
type Finished = { file: File; image: ImageInspection | null }

const IDS_PER_REQUEST = 20 // 서버 `images` 의 한 번 상한

const tail = (key: string) => key.slice(key.lastIndexOf('/') + 1)

/**
 * 사진 여러 장 올리기 — `FilePicker` 위에 장마다 로컬 미리보기 · 진행률 · 서버 거절 문구 · 「처리 중」 · 지우기를 얹는다.
 * `value` 는 부모가 쥔 키 목록이다(올리기가 끝나면 `onChange` 로 키가 더해진다). 순서 바꾸기 · 자르기는 없다.
 */
export function ImageUploadField({
  uploader,
  api,
  value,
  onChange,
  max = 10,
  accept = 'image/*',
  labels = defaultImageUploadLabels,
}: ImageUploadFieldProps) {
  const [uploads, setUploads] = useState<Upload[]>([])
  const [finished, setFinished] = useState<Record<string, Finished>>({})
  const [remote, setRemote] = useState<Record<string, StoredImageItem>>({})
  const latest = useRef({ value, onChange })
  const controllers = useRef(new Map<number, AbortController>())
  const nextId = useRef(0)
  const requested = useRef(new Set<string>())

  useEffect(() => {
    latest.current = { value, onChange }
  })
  useEffect(() => {
    const running = controllers.current
    return () => running.forEach((controller) => controller.abort())
  }, [])
  useEffect(() => {
    const images = api?.images
    if (!images) return
    const missing = value.filter((key) => !(key in finished) && !requested.current.has(key))
    for (let i = 0; i < missing.length; i += IDS_PER_REQUEST) {
      const chunk = missing.slice(i, i + IDS_PER_REQUEST)
      chunk.forEach((key) => requested.current.add(key))
      images(chunk).then(
        (items) =>
          setRemote((known) => ({
            ...known,
            ...Object.fromEntries(items.map((it) => [it.key, it])),
          })),
        () => chunk.forEach((key) => requested.current.delete(key)),
      )
    }
  }, [api, value, finished])

  const uploading = uploads.filter((upload) => !upload.problem).length
  const full = value.length + uploading >= max

  const problemOf = (error: unknown): string => {
    if (error instanceof UploadRejectedError || error instanceof StorageValidationError)
      return [...new Set(error.errors.map((e) => labels.reasons[e.code] ?? labels.rejected))].join(
        ' ',
      )
    return labels.failed
  }

  const start = (file: File) => {
    const id = nextId.current++
    const controller = new AbortController()
    controllers.current.set(id, controller)
    const drop = () => setUploads((list) => list.filter((upload) => upload.id !== id))
    setUploads((list) => [...list, { id, file, fraction: 0 }])
    uploader
      .upload(file, {
        signal: controller.signal,
        onProgress: ({ fraction }) =>
          setUploads((list) => list.map((u) => (u.id === id ? { ...u, fraction } : u))),
      })
      .then((result) => {
        drop()
        setFinished((known) => ({
          ...known,
          [result.key]: { file, image: result.inspection?.image ?? null },
        }))
        const keys = [...latest.current.value, result.key]
        latest.current.value = keys
        latest.current.onChange(keys)
      })
      .catch((error: unknown) => {
        if (error instanceof UploadAbortedError) return drop()
        setUploads((list) =>
          list.map((u) => (u.id === id ? { ...u, problem: problemOf(error) } : u)),
        )
      })
      .finally(() => controllers.current.delete(id))
  }

  const onFiles = (files: File[]) => {
    files.slice(0, Math.max(0, max - value.length - uploading)).forEach(start)
  }

  const removeKey = (key: string) => {
    const keys = value.filter((k) => k !== key)
    latest.current.value = keys
    onChange(keys)
    setFinished((known) => {
      const rest = { ...known }
      delete rest[key]
      return rest
    })
  }
  const removeUpload = (id: number) => {
    controllers.current.get(id)?.abort()
    setUploads((list) => list.filter((upload) => upload.id !== id))
  }

  return (
    <div className={styles.root}>
      <FilePicker
        title={labels.title}
        hint={labels.hint}
        buttonLabel={labels.chooseButton}
        accept={accept}
        multiple
        disabled={full}
        onFiles={onFiles}
      />
      {(value.length > 0 || uploads.length > 0) && (
        <ul className={styles.list}>
          {value.map((key) => {
            const done = finished[key]
            const item = remote[key]
            return (
              <Tile
                key={key}
                name={done?.file.name ?? tail(key)}
                file={done?.file ?? null}
                stored={item}
                status={done ? done.image?.status : item?.status}
                labels={labels}
                onRemove={() => removeKey(key)}
              />
            )
          })}
          {uploads.map((upload) => (
            <Tile
              key={`upload-${upload.id}`}
              name={upload.file.name}
              file={upload.file}
              fraction={upload.problem ? undefined : upload.fraction}
              problem={upload.problem}
              labels={labels}
              onRemove={() => removeUpload(upload.id)}
            />
          ))}
        </ul>
      )}
      {full && <p className={styles.limit}>{labels.limitReached(max)}</p>}
    </div>
  )
}

type TileProps = {
  name: string
  file: File | null
  stored?: StoredImageItem
  status?: ImageStatus | null
  /** 올리는 중일 때만 */
  fraction?: number
  problem?: string
  labels: ImageUploadLabels
  onRemove: () => void
}

function Tile({ name, file, stored, status, fraction, problem, labels, onRemove }: TileProps) {
  const preview = useFilePreview(file)
  const note =
    status === 'PENDING'
      ? labels.processing
      : status === 'UNSUPPORTED'
        ? labels.unsupported
        : status === 'REJECTED' || status === 'FAILED'
          ? labels.unavailable
          : null
  return (
    <li
      className={styles.tile}
      data-state={fraction !== undefined ? 'uploading' : problem ? 'failed' : 'done'}
    >
      <div className={styles.preview}>
        {preview ? (
          <img src={preview} alt={name} />
        ) : stored && (stored.thumb || stored.display) ? (
          <StoredImage image={stored} alt={name} sizes="11rem" />
        ) : (
          name
        )}
      </div>
      {fraction !== undefined && (
        <Progress
          label={labels.uploading(name)}
          value={fraction}
          valueText={`${Math.round(fraction * 100)}%`}
        />
      )}
      {note && <p className={styles.status}>{note}</p>}
      {problem && (
        <p role="alert" className={styles.problem}>
          {problem}
        </p>
      )}
      <Button variant="ghost" size="sm" aria-label={labels.removeNamed(name)} onClick={onRemove}>
        {labels.remove}
      </Button>
    </li>
  )
}
