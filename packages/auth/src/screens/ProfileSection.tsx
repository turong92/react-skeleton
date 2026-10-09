import { ErrorCodes } from '@skeleton/api-client'
import { Alert, Button, CopyButton, Field, Input, Select, SettingsRow } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import { SectionShell } from './SectionShell'
import { SettingsDialog } from './SettingsDialog'
import type { ProfilePatch } from '../account/types'
import styles from './auth.module.css'
import { displayNameFieldError, displayNameProblem } from './displayName'
import { displayNameRateLimited } from './errors'
import { mergeLabels, type AuthLabels } from './labels'
import { useAction } from './useAction'

export type ProfileSectionProps = {
  profile: {
    displayName: string | null
    /** 서버가 붙인 꼬리표 — 있으면 `닉네임#번호` 줄을 보여 준다 */
    displayTag?: string | null
    locale: string | null
    timeZone: string | null
  }
  /** 고를 수 있는 언어(백엔드가 허용하는 BCP47 목록과 맞춘다) */
  locales: Array<{ value: string; label: string }>
  /** 고를 수 있는 시간대(IANA). 보통 `Intl.supportedValuesOf('timeZone')` */
  timeZones: string[]
  onSave: (patch: ProfilePatch) => Promise<unknown>
  labels?: Partial<AuthLabels>
  /**
   * 닉네임 줄(칸 · `닉네임#번호`)을 보인다(기본 true). 글 · 댓글의 이름을 작성자 닉네임(`@skeleton/author-profile`)으로 따로 쓰는 앱은 끈다 —
   * 계정 이름이 화면에 둘이 되지 않게. 끄면 언어 · 시간대만 남고 닉네임은 저장 요청에도 실리지 않는다
   */
  showDisplayName?: boolean
  /** 줄만 그린다(`AccountSettings` 의 카드 안) - 아니면 제목 있는 카드 한 장에 담는다 */
  row?: boolean
  /** 첫 렌더부터 대화상자가 열려 있다 - 서버 렌더 시험 · 스토리용 */
  initiallyOpen?: boolean
}

/** 프로필 절 — 닉네임(꼬리표가 있으면 `닉네임#번호` 와 복사) · 언어 · 시간대를 값으로 보이고, 「프로필 수정」이 양식을 대화상자로 연다 */
export function ProfileSection({
  profile,
  locales,
  timeZones,
  onSave,
  labels: given,
  showDisplayName = true,
  row,
  initiallyOpen = false,
}: ProfileSectionProps) {
  const labels = mergeLabels(given)
  const [open, setOpen] = useState(initiallyOpen)
  const [saved, setSaved] = useState(false)
  const fullName =
    profile.displayName && profile.displayTag
      ? `${profile.displayName}#${profile.displayTag}`
      : null
  const localeName = locales.find((l) => l.value === profile.locale)?.label ?? profile.locale
  const summary = [
    showDisplayName ? (fullName ?? profile.displayName) : null,
    localeName,
    profile.timeZone,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <SectionShell row={row} id="profile" title={labels.sectionProfile}>
      <SettingsRow
        label={labels.sectionProfile}
        value={
          <>
            <strong>{summary || labels.profileLocaleDefault}</strong>
            {showDisplayName && fullName && <CopyButton value={fullName} label={labels.copyHint} />}
          </>
        }
        action={
          <Button
            variant="secondary"
            size="sm"
            aria-label={`${labels.sectionProfile} ${labels.rowChange}`}
            onClick={() => {
              setSaved(false)
              setOpen(true)
            }}
          >
            {labels.rowChange}
          </Button>
        }
        dialogs={
          <>
            <SettingsDialog
              open={open}
              onClose={() => setOpen(false)}
              title={labels.sectionProfile}
              closeLabel={labels.dialogClose}
            >
              <ProfileForm
                profile={profile}
                locales={locales}
                timeZones={timeZones}
                onSave={onSave}
                labels={given}
                showDisplayName={showDisplayName}
                onSaved={() => {
                  setSaved(true)
                  setOpen(false)
                }}
                onCancel={() => setOpen(false)}
              />
            </SettingsDialog>
          </>
        }
      >
        {saved && <Alert tone="success">{labels.profileSaved}</Alert>}
      </SettingsRow>
    </SectionShell>
  )
}

function ProfileForm({
  profile,
  locales,
  timeZones,
  onSave,
  labels: given,
  showDisplayName,
  onSaved,
  onCancel,
}: ProfileSectionProps & { showDisplayName: boolean; onSaved: () => void; onCancel: () => void }) {
  const labels = mergeLabels(given)
  const [displayName, setDisplayName] = useState(profile.displayName ?? '')
  const [locale, setLocale] = useState(profile.locale ?? '')
  const [timeZone, setTimeZone] = useState(profile.timeZone ?? '')
  const action = useAction(labels)
  const [localProblem, setLocalProblem] = useState<string>()
  // 닉네임 칸 아래에 말하는 서버 답: 겹침(409) · 변경 한도(429) · 규칙 위반(400 필드 오류) — 서버의 영어 문장은 보이지 않는다. 전역 토스트는 앱이 이 코드들을 뺀다
  const nameMessage = action.error
    ? action.error.code === ErrorCodes.ACCOUNT_DISPLAY_NAME_TAKEN
      ? action.error.message
      : (displayNameRateLimited(action.raw, labels) ?? displayNameFieldError(action.raw, labels))
    : undefined
  const nameTaken = nameMessage !== undefined
  const fullName =
    profile.displayName && profile.displayTag
      ? `${profile.displayName}#${profile.displayTag}`
      : null

  async function submit(event: FormEvent) {
    event.preventDefault()
    const problem = showDisplayName
      ? displayNameProblem(displayName, 'optional', labels)
      : undefined
    setLocalProblem(problem)
    if (problem) return
    const patch: ProfilePatch = {}
    if (showDisplayName && displayName.trim() && displayName !== (profile.displayName ?? ''))
      patch.displayName = displayName.trim()
    if (locale && locale !== (profile.locale ?? '')) patch.locale = locale
    if (timeZone && timeZone !== (profile.timeZone ?? '')) patch.timeZone = timeZone
    if (Object.keys(patch).length === 0) return onSaved()
    if (await action.run(() => onSave(patch))) onSaved()
  }

  return (
    <>
      <form className={styles.form} onSubmit={submit} aria-label={labels.sectionProfile}>
        {action.error && !nameTaken && <Alert tone="danger">{action.error.message}</Alert>}
        {showDisplayName && (
          <Field
            label={labels.displayName}
            hint={labels.displayNameHint}
            error={localProblem ?? (nameTaken ? nameMessage : undefined)}
          >
            {(control) => (
              <Input
                {...control}
                autoComplete="nickname"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  setLocalProblem(undefined)
                  if (nameTaken) action.clear()
                }}
              />
            )}
          </Field>
        )}
        {showDisplayName && fullName && (
          <p className={styles.shownAs}>
            <span>{labels.displayNameShownAs}</span> <strong>{fullName}</strong>{' '}
            <CopyButton value={fullName} label={labels.copyHint} />
          </p>
        )}
        <Field label={labels.profileLocale}>
          {(control) => (
            <Select {...control} value={locale} onChange={(e) => setLocale(e.target.value)}>
              {!profile.locale && <option value="">{labels.profileLocaleDefault}</option>}
              {locales.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={labels.profileTimeZone}>
          {(control) => (
            <Select {...control} value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
              {!profile.timeZone && <option value="">{labels.profileLocaleDefault}</option>}
              {timeZones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className={styles.row}>
          <Button type="submit" loading={action.busy} loadingLabel={labels.submitting}>
            {labels.save}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            {labels.cancel}
          </Button>
        </div>
      </form>
    </>
  )
}
