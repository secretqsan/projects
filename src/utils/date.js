const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

export function localDay(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  }
  if (typeof value !== 'string') return null
  const matched = value.match(ISO)
  if (!matched) return null
  const year = Number(matched[1])
  const month = Number(matched[2])
  const day = Number(matched[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

export function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayISO() {
  return formatLocalDate(new Date())
}

export function isValidISODate(value) {
  return typeof value === 'string' && localDay(value) !== null
}

export function addISODays(isoDate, days) {
  const day = localDay(isoDate)
  if (!day) return isoDate
  day.setDate(day.getDate() + days)
  return formatLocalDate(day)
}

export function diffISODays(start, end) {
  const startDay = localDay(start)
  const endDay = localDay(end)
  if (!startDay || !endDay) return 0
  return Math.round((endDay.getTime() - startDay.getTime()) / 86400000)
}

export function formatDateShort(date) {
  const day = localDay(date)
  return day ? `${day.getMonth() + 1}/${day.getDate()}` : ''
}
