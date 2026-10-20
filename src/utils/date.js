import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(customParseFormat)

const ISO = 'YYYY-MM-DD'

export function todayISO() {
  return dayjs().format(ISO)
}

export function isValidISODate(value) {
  return typeof value === 'string' && dayjs(value, ISO, true).isValid()
}

export function addISODays(isoDate, days) {
  if (!isValidISODate(isoDate)) return isoDate
  return dayjs(isoDate, ISO, true).add(days, 'day').format(ISO)
}

export function diffISODays(start, end) {
  if (!isValidISODate(start) || !isValidISODate(end)) return 0
  return dayjs(end, ISO, true).diff(dayjs(start, ISO, true), 'day')
}

export function formatDateShort(date) {
  const d = dayjs(date)
  return d.isValid() ? d.format('M/D') : ''
}
