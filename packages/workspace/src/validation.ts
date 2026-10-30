import type { WorkspaceLabels } from './labels'
import { SLUG_MAX, SLUG_MIN, slugProblem } from './slug'

/** 서버 `workspaces.name varchar(100)` */
export const NAME_MAX = 100

export type FormErrors = { name?: string; slug?: string }

/**
 * 이름 · 주소 이름 칸의 틀린 곳을 문장으로. 주소가 비어 있으면 만들 때는 괜찮고(서버가 이름에서 정한다),
 * 설정에서는 비울 수 없다(`slugRequired`)
 */
export function validateWorkspaceForm(
  labels: WorkspaceLabels,
  input: { name: string; slug: string; slugRequired?: boolean },
): FormErrors {
  const errors: FormErrors = {}
  const name = input.name.trim()
  if (name.length === 0) errors.name = labels.form.nameRequired
  else if (name.length > NAME_MAX) errors.name = labels.form.nameTooLong(NAME_MAX)
  if (input.slug.length > 0 || input.slugRequired) {
    const problem = slugProblem(input.slug)
    if (problem === 'length') errors.slug = labels.form.slugLength(SLUG_MIN, SLUG_MAX)
    else if (problem === 'format') errors.slug = labels.form.slugFormat
  }
  return errors
}
