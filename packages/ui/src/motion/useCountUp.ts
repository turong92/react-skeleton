import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { prefersReducedMotion } from './prefersReducedMotion'

export type CountUpOptions = {
  /** 올라가는 시간(ms, 기본 800) */
  durationMs?: number
  /** 시작 값(기본 0) */
  from?: number
  /** 소수 자릿수(기본 0 — 정수로 반올림) */
  decimals?: number
  /** true 면 `ref` 를 단 요소가 화면에 들어올 때 시작한다(그 전엔 시작 값) */
  startOnView?: boolean
}

const easeOutCubic = (progress: number) => 1 - (1 - progress) ** 3

/**
 * 숫자가 시작 값에서 `target` 까지 올라간다(ease-out — 끝에서 느려진다). `target` 이 바뀌면 보이던 값에서 이어 올라간다.
 * 움직임 줄이기 설정이면 바로 `target`. 서버 · 자바스크립트 전에는 `target` 이 보인다(올라가기는 마운트 뒤에 시작한다)
 */
export function useCountUp<T extends HTMLElement = HTMLElement>(
  target: number,
  { durationMs = 800, from = 0, decimals = 0, startOnView = false }: CountUpOptions = {},
): { value: number; ref: RefObject<T | null> } {
  const ref = useRef<T>(null)
  const [value, setValue] = useState(target)
  /** 지금 보이는(반올림 전) 값 — 새 목표로 이어 올라갈 때의 출발 */
  const shown = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (prefersReducedMotion()) {
      shown.current = target
      setValue(target) // eslint-disable-line react-hooks/set-state-in-effect -- 설정(외부)을 따라 값을 맞춘다
      return
    }
    const begin = shown.current ?? from
    shown.current = begin
    setValue(begin) // 하이드레이션 값(target)에서 시작 값으로 — 마운트 뒤에만
    let frame = 0
    let observer: IntersectionObserver | undefined
    const run = () => {
      let startedAt: number | undefined
      const step = (now: number) => {
        startedAt ??= now
        const progress = Math.min(1, (now - startedAt) / durationMs)
        shown.current = begin + (target - begin) * easeOutCubic(progress)
        setValue(shown.current)
        if (progress < 1) frame = requestAnimationFrame(step)
      }
      frame = requestAnimationFrame(step)
    }
    const element = ref.current
    if (startOnView && element && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer?.disconnect()
        run()
      })
      observer.observe(element)
    } else run()
    return () => {
      observer?.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [target, durationMs, from, startOnView])

  const scale = 10 ** decimals
  return { value: Math.round(value * scale) / scale, ref }
}
