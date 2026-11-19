import type { VideoPlayerLabels } from './labels'
import type { QualityChoice } from './playbackPlan'

/** 화질 이름에 쓰는 높이 - 짧은 변(세로 영상 1080x1920 도 1080p). 크기를 모르면 null */
export function heightOfSize(width: number, height: number): number | null {
  const short = Math.min(width, height)
  return Number.isFinite(short) && short > 0 ? short : null
}

/**
 * 화질 이름 - 실제 높이(`1080p` · `2160p`), 모르면 옛 이름(원본 · 720p). 자동은 지금 나오는 높이를 덧붙인다(`자동 (1080p)`)
 */
export function qualityLabel(
  labels: Pick<VideoPlayerLabels, 'auto' | 'original' | 'qualityHeight'>,
  value: QualityChoice,
  height: number | null,
  playingHeight: number | null,
): string {
  if (value === 'auto')
    return playingHeight ? `${labels.auto} (${labels.qualityHeight(playingHeight)})` : labels.auto
  if (value === 'compat') return labels.qualityHeight(height ?? 720)
  return height ? labels.qualityHeight(height) : labels.original
}
