import { formatLocalDate, localDay } from '../../../utils/date.js'

export const MS_PER_DAY = 86400000

export function getPixelsPerDay(visibleWidth, timeSpan) {
  return visibleWidth / timeSpan
}

export function dateToPixelOffset(date, centerDate, pixelsPerDay) {
  const day = localDay(date)
  if (!day) return 0
  const diffDays = (day.getTime() - centerDate.getTime()) / MS_PER_DAY
  return diffDays * pixelsPerDay
}

export function snapOffsetToDay(offset, centerDate, pixelsPerDay) {
  if (!pixelsPerDay) return offset
  const instant = new Date(centerDate.getTime() + (offset / pixelsPerDay) * MS_PER_DAY)
  const dayStart = new Date(instant.getFullYear(), instant.getMonth(), instant.getDate())
  const nextDay = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1)
  const halfway = dayStart.getTime() + (nextDay.getTime() - dayStart.getTime()) / 2
  const nearest = instant.getTime() >= halfway ? nextDay : dayStart
  return ((nearest.getTime() - centerDate.getTime()) / MS_PER_DAY) * pixelsPerDay
}

export function offsetToISODate(offset, centerDate, pixelsPerDay) {
  const snapped = snapOffsetToDay(offset, centerDate, pixelsPerDay)
  return formatLocalDate(new Date(centerDate.getTime() + (snapped / pixelsPerDay) * MS_PER_DAY))
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * MS_PER_DAY)
}
