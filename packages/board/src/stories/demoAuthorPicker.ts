import { createElement } from 'react'
import type { AuthorPicker } from '../authorship'
import { DemoPicker } from './DemoPicker'

export type DemoProfile = { id: string; name: string }

const DEMO_PROFILES: readonly DemoProfile[] = [
  { id: 'prf_a', name: 'Ann' },
  { id: 'prf_b', name: 'Bea' },
]

/** 스토리 · 시험용 `authorPicker` — `Select` 하나(+ 한 줄 확인). `remembered` 는 기기 기억 흉내. 계약 설명은 `DemoPicker.tsx` */
export const demoAuthorPicker =
  (
    profiles: readonly DemoProfile[] = DEMO_PROFILES,
    label = 'Post as',
    placeholder = 'Choose…',
    remembered?: string,
  ): AuthorPicker =>
  (args) =>
    createElement(DemoPicker, { ...args, profiles, label, placeholder, remembered })
