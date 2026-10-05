import { todayInZone } from '@skeleton/time'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn } from 'storybook/test'
import { Field } from '../Field/Field'
import { DatePicker, type DatePickerProps } from './DatePicker'
import { DateRangePicker, type DateRange } from './DateRangePicker'

/**
 * 날짜 고르기 — 네이티브 `<input type="date">`(달력 팝업 · 키보드 · 모바일 선택기 · 지역화를 브라우저가 한다) 위에, 고른 날을 글로 읽어 주고
 * 시간대에 맞는 「오늘」 버튼을 더했다. 값은 `YYYY-MM-DD` 문자열 — 달력 날짜는 시간대로 옮기지 않는다(`@skeleton/time`).
 * 기간(`DateRangePicker`)은 시작 ~ 끝을 `fieldset` 으로 묶고 거꾸로 쳐 넣으면 끝칸에 오류를 붙인다.
 */
const onChange = fn()
const meta = {
  title: 'UI/DatePicker',
  component: DatePicker,
  args: { value: '', onChange, locale: 'ko-KR' },
  beforeEach: () => onChange.mockClear(),
} satisfies Meta<typeof DatePicker>
export default meta
type Story = StoryObj<typeof meta>

function PickerDemo(props: Partial<DatePickerProps>) {
  const [value, setValue] = useState(props.value ?? '')
  return (
    <Field label="Due date" hint="Calendar date, no time zone">
      {(control) => (
        <DatePicker
          {...control}
          locale="ko-KR"
          {...props}
          value={value}
          onChange={(next) => {
            onChange(next)
            setValue(next)
          }}
        />
      )}
    </Field>
  )
}

export const TypeADateAndHearItInWords: Story = {
  render: () => <PickerDemo />,
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByLabelText('Due date')
    await expect(input).toHaveAttribute('type', 'date')
    await userEvent.type(input, '2026-10-06')
    await expect(onChange).toHaveBeenLastCalledWith('2026-10-06')
    await expect(canvas.getByText('2026년 10월 6일')).toBeVisible()
  },
}

export const TodayButtonCountsInTheGivenZone: Story = {
  render: () => <PickerDemo todayLabel="Today" zone="Pacific/Kiritimati" />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Today' }))
    await expect(canvas.getByLabelText('Due date')).toHaveValue(todayInZone('Pacific/Kiritimati'))
  },
}

export const TodayIsKeptInsideMinAndMax: Story = {
  render: () => <PickerDemo todayLabel="Today" min="2999-01-01" />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Today' }))
    await expect(canvas.getByLabelText('Due date')).toHaveValue('2999-01-01')
  },
}

export const Invalid: Story = {
  render: () => (
    <Field label="Due date" error="Pick a day">
      {(control) => <DatePicker {...control} value="" onChange={onChange} />}
    </Field>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('Due date')).toHaveAttribute('aria-invalid', 'true')
    await expect(canvas.getByRole('alert')).toHaveTextContent('Pick a day')
  },
}

function RangeDemo({ initial }: { initial: DateRange }) {
  const [value, setValue] = useState(initial)
  return (
    <DateRangePicker
      legend="Stay"
      startLabel="From"
      endLabel="To"
      value={value}
      onChange={setValue}
      locale="en-US"
      orderMessage="End must not be before start"
    />
  )
}

export const RangeBoundsEachOtherAndSummarises: Story = {
  render: () => <RangeDemo initial={{ start: '2026-10-06', end: '2026-10-09' }} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('group', { name: 'Stay' })).toBeVisible()
    await expect(canvas.getByLabelText('From')).toHaveAttribute('max', '2026-10-09')
    await expect(canvas.getByLabelText('To')).toHaveAttribute('min', '2026-10-06')
    await expect(canvas.getByText('October 6, 2026 – October 9, 2026')).toBeVisible()
  },
}

export const RangeEndBeforeStartIsAnError: Story = {
  render: () => <RangeDemo initial={{ start: '2026-10-09', end: '2026-10-06' }} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('End must not be before start')
    await expect(canvas.getByLabelText('To')).toHaveAttribute('aria-invalid', 'true')
  },
}

export const RangeFixedByTyping: Story = {
  render: () => <RangeDemo initial={{ start: '', end: '' }} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('From'), '2026-10-06')
    await userEvent.type(canvas.getByLabelText('To'), '2026-10-09')
    await expect(canvas.getByText('October 6, 2026 – October 9, 2026')).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  render: () => <RangeDemo initial={{ start: '2026-10-06', end: '2026-10-09' }} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('group', { name: 'Stay' })).toBeVisible()
  },
}
