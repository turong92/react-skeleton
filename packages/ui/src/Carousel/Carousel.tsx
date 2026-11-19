import { Children, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { prefersReducedMotion } from '../motion/prefersReducedMotion'
import styles from './Carousel.module.css'

export type CarouselProps = {
  /** 캐러셀의 이름(낭독) — 예: `Featured plans` */
  label: string
  /** 슬라이드 하나씩 — 자식 하나가 슬라이드 하나 */
  children: ReactNode
  previousLabel?: string
  nextLabel?: string
  /** 슬라이드 이름 · 현재 위치 글자. n 은 1 부터(기본 `n / total`) */
  slideLabel?: (n: number, total: number) => string
}

/**
 * 옆으로 넘기는 줄 — CSS scroll-snap 이라 손가락 스와이프 · 트랙패드는 네이티브 스크롤이다(WAI-ARIA APG carousel 패턴).
 * 이전 · 다음 단추와 ←/→ 키(줄이나 단추에 포커스가 있을 때)로도 넘기고, 글자(`1 / 3`)로 지금 위치를 보인다. 자동 재생은 없다.
 * 슬라이드는 한 번에 하나씩 보이는 폭이다
 */
export function Carousel({
  label,
  children,
  previousLabel = 'Previous slide',
  nextLabel = 'Next slide',
  slideLabel = (n, total) => `${n} / ${total}`,
}: CarouselProps) {
  const slides = Children.toArray(children)
  const total = slides.length
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  if (total === 0) return null

  const go = (target: number) => {
    const next = Math.min(total - 1, Math.max(0, target))
    if (next === index) return
    // 스냅 위치로 스크롤할 뿐 `index` 는 스크롤 이벤트가 따라 바꾼다 — 손가락 스와이프와 같은 한 길(위치 표시가 깜박이지 않는다)
    trackRef.current?.children[next]?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'start',
    })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    // 슬라이드 안의 입력칸에서 쓰는 화살표는 뺏지 않는다 — 줄 자신이나 단추일 때만
    const target = event.target as HTMLElement
    if (target !== trackRef.current && target.tagName !== 'BUTTON') return
    event.preventDefault()
    go(index + (event.key === 'ArrowRight' ? 1 : -1))
  }

  return (
    <section
      className={styles.carousel}
      aria-roledescription="carousel"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      <div
        ref={trackRef}
        className={styles.track}
        tabIndex={0}
        onScroll={(event) => {
          const track = event.currentTarget
          if (track.clientWidth === 0) return
          const at = Math.round(Math.abs(track.scrollLeft) / track.clientWidth)
          setIndex(Math.min(total - 1, at))
        }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            className={styles.slide}
            role="group"
            aria-roledescription="slide"
            aria-label={slideLabel(i + 1, total)}
          >
            {slide}
          </div>
        ))}
      </div>
      {total > 1 && (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.button}
            aria-label={previousLabel}
            aria-disabled={index === 0 || undefined}
            onClick={() => go(index - 1)}
          >
            ‹
          </button>
          <span className={styles.position}>{slideLabel(index + 1, total)}</span>
          <button
            type="button"
            className={styles.button}
            aria-label={nextLabel}
            aria-disabled={index === total - 1 || undefined}
            onClick={() => go(index + 1)}
          >
            ›
          </button>
        </div>
      )}
    </section>
  )
}
