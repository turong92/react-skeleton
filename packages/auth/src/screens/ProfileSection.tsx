import { ErrorCodes } from '@skeleton/api-client'
import { Alert, Button, CopyButton, Field, Input, Select, SectionCard } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import type { ProfilePatch } from '../account/types'
import styles from './auth.module.css'
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
}

/** 프로필 절 — 닉네임(꼬리표가 있으면 `닉네임#번호` 와 복사) · 언어 · 시간대 */
export function ProfileSection({
  profile,
  locales,
  timeZones,
  onSave,
  labels: given,
}: ProfileSectionProps) {
  const labels = mergeLabels(given)
  const [displayName, setDisplayName] = useState(profile.displayName ?? '')
  const [locale, setLocale] = useState(profile.locale ?? '')
  const [timeZone, setTimeZone] = useState(profile.timeZone ?? '')
  const [saved, setSaved] = useState(false)
  const action = useAction(labels)
  const nameTaken = action.error?.code === ErrorCodes.ACCOUNT_DISPLAY_NAME_TAKEN
  const fullName =
    profile.displayName && profile.displayTag
      ? `${profile.displayName}#${profile.displayTag}`
      : null

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    const patch: ProfilePatch = {}
    if (displayName.trim() && displayName !== (profile.displayName ?? ''))
      patch.displayName = displayName.trim()
    if (locale && locale !== (profile.locale ?? '')) patch.locale = locale
    if (timeZone && timeZone !== (profile.timeZone ?? '')) patch.timeZone = timeZone
    if (Object.keys(patch).length === 0) return setSaved(true)
    setSaved(await action.run(() => onSave(patch)))
  }

  return (
    <SectionCard id="profile" title={labels.sectionProfile}>
      <form className={styles.form} onSubmit={submit} aria-label={labels.sectionProfile}>
        {action.error && !nameTaken && <Alert tone="danger">{action.error.message}</Alert>}
        {saved && <Alert tone="success">{labels.profileSaved}</Alert>}
        <Field
          label={labels.displayName}
          hint={labels.displayNameHint}
          error={nameTaken ? action.error?.message : undefined}
        >
          {(control) => (
            <Input
              {...control}
              autoComplete="nickname"
              maxLength={60}
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value)
                if (nameTaken) action.clear()
              }}
            />
          )}
        </Field>
        {fullName && (
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
        <div>
          <Button type="submit" loading={action.busy} loadingLabel={labels.submitting}>
            {labels.save}
          </Button>
        </div>
      </form>
    </SectionCard>
  )
}
