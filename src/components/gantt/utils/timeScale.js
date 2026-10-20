import dayjs from 'dayjs'

export const MS_PER_DAY = 86400000

export function getPixelsPerDay(visibleWidth, timeSpan) {
  return visibleWidth / timeSpan
}

export function dateToPixelOffset(date, centerDate, pixelsPerDay) {
  // 任务日期按本地日界；centerDate 可含亚整天偏移（画布平移用）
  const dateMs = dayjs(date).startOf('day').valueOf()
  const diffDays = (dateMs - centerDate.getTime()) / MS_PER_DAY
  return diffDays * pixelsPerDay
}

export function offsetToISODate(offset, centerDate, pixelsPerDay) {
  const ms = centerDate.getTime() + (offset / pixelsPerDay) * MS_PER_DAY
  // 使用本地日历日，避免 toISOString（UTC）在东八区等时区产生日期偏移
  return dayjs(ms).format('YYYY-MM-DD')
}

export function addDays(date, days) {
  // 保留亚整天偏移，避免平移提交时被按整天截断
  return new Date(date.getTime() + days * MS_PER_DAY)
}
