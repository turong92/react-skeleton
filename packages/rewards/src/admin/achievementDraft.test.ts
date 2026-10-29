import { describe, expect, it } from 'vitest'
import { achievementProblems, hasAchievementProblem } from './achievementDraft'

const point = { type: 'point', params: { amount: '100' } }
const ok = { metric: 'notes.created', milestones: [{ value: 1, rewards: [point] }] }

describe('achievementProblems', () => {
  it('accepts a valid config', () => {
    expect(hasAchievementProblem(achievementProblems(ok))).toBe(false)
  })

  it('rejects a metric name outside [a-z0-9._-]{1,64}', () => {
    for (const metric of ['', 'Notes', 'a b', 'x'.repeat(65)])
      expect(achievementProblems({ ...ok, metric }).metric, metric).toBe(true)
  })

  it('rejects zero steps and more than 20', () => {
    expect(achievementProblems({ ...ok, milestones: [] }).count).toBe(true)
    const many = Array.from({ length: 21 }, (_, i) => ({ value: i + 1, rewards: [point] }))
    expect(achievementProblems({ ...ok, milestones: many }).count).toBe(true)
  })

  it('wants values of at least 1 in strictly ascending order, and says which step is wrong', () => {
    const p = achievementProblems({
      ...ok,
      milestones: [
        { value: 5, rewards: [point] },
        { value: 5, rewards: [point] },
        { value: 3, rewards: [point] },
        { value: 0, rewards: [point] },
        { value: 9, rewards: [point] },
      ],
    })
    expect(p.value).toEqual([false, true, true, true, false])
  })

  it('wants every step to give something, with the reward filled in', () => {
    const p = achievementProblems({
      ...ok,
      milestones: [
        { value: 1, rewards: [] },
        { value: 2, rewards: [{ type: 'badge', params: { code: '' } }] },
        { value: 3, rewards: [{ type: 'badge', params: { code: 'writer' } }] },
      ],
    })
    expect(p.rewards).toEqual([true, true, false])
  })
})
