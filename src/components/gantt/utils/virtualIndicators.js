const YEAR_LABEL_WIDTH = 64

function pixelsPerMs(sorted) {
  const origin = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    const dx = sorted[i].pixelPosition - origin.pixelPosition
    const dt = sorted[i].date.getTime() - origin.date.getTime()
    if (dx !== 0 && dt !== 0) return dx / dt
  }
  return null
}

export function computeYearIndicators(renderIndicators, visibleWidth) {
  if (!renderIndicators.length) return []

  const sorted = [...renderIndicators].sort((a, b) => a.pixelPosition - b.pixelPosition)
  const scale = pixelsPerMs(sorted)
  if (!scale) return []

  const origin = sorted[0]
  const pixelAt = (ms) => origin.pixelPosition + (ms - origin.date.getTime()) * scale
  const firstYear = origin.date.getFullYear()
  const lastYear = sorted[sorted.length - 1].date.getFullYear()

  const visibleYears = []
  for (let year = firstYear; year <= lastYear; year++) {
    const startMs = new Date(year, 0, 1).getTime()
    const startX = pixelAt(startMs)
    const endX = pixelAt(new Date(year + 1, 0, 1).getTime())
    if (endX <= 0 || startX >= visibleWidth) continue
    // 对齐到 1 月 1 日当天或之后的第一条刻度线，标签左边缘贴在这条线上
    const lineTick = sorted.find(tick => tick.date.getTime() >= startMs)
    visibleYears.push({
      year,
      lineX: lineTick ? lineTick.pixelPosition : startX
    })
  }

  const positions = visibleYears.map(year => year.lineX)
  if (positions.length === 1) {
    positions[0] = Math.max(positions[0], 0)
  } else if (positions.length > 1 && positions[0] < 0) {
    positions[0] = 0
  }
  for (let i = 0; i < positions.length - 1; i++) {
    const maxX = positions[i + 1] - YEAR_LABEL_WIDTH
    if (positions[i] > maxX) positions[i] = maxX
  }

  return visibleYears.flatMap((year, index) => {
    const x = positions[index]
    if (x <= -YEAR_LABEL_WIDTH || x > visibleWidth) return []
    return [{ pixelPosition: x, year: year.year }]
  })
}
