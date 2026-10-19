export const MS_PER_DAY = 86400000

export function getPixelsPerDay(visibleWidth, timeSpan) {
  return visibleWidth / timeSpan
}

export function dateToPixelOffset(date, centerDate, pixelsPerDay) {
  const diffDays = (new Date(date).getTime() - centerDate.getTime()) / MS_PER_DAY
  return diffDays * pixelsPerDay
}

export function offsetToISODate(offset, centerDate, pixelsPerDay) {
  const ms = centerDate.getTime() + (offset / pixelsPerDay) * MS_PER_DAY
  const dayMs = Math.round(ms / MS_PER_DAY) * MS_PER_DAY
  return new Date(dayMs).toISOString().slice(0, 10)
}

export function formatDateShort(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function addDays(date, days) {
  // 使用毫秒运算：setDate 会截断小数天数，导致平移提交时丢失不足一天的偏移
  return new Date(date.getTime() + days * MS_PER_DAY)
}

export function findEarliestTaskDate(tasks) {
  let earliest = null
  for (const task of tasks || []) {
    const taskStart = new Date(task.start_date)
    if (Number.isNaN(taskStart.getTime())) continue
    if (!earliest || taskStart < earliest) earliest = taskStart
  }
  return earliest || new Date()
}
