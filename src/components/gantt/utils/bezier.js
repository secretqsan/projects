/**
 * 计算依赖连线的贝塞尔曲线路径
 */
export function calculateBezierPath(startDir, x1, y1, x2, y2) {
  const dx = x2 - x1
  const absDx = Math.abs(dx)
  const startControlDir = startDir === 'left' ? -1 : 1
  const endControlDir = -startControlDir
  const baseOffset = 50
  const maxExtraOffset = 100
  const relativePos = dx * startControlDir
  const smoothFactor = Math.tanh(relativePos / 100)
  const distanceFactor = Math.min(absDx / 200, 1)
  const oppositeFactor = (1 - smoothFactor) / 2
  const startOffset = (baseOffset + maxExtraOffset * oppositeFactor * (1 - distanceFactor)) * startControlDir
  const endOffset = (baseOffset + maxExtraOffset * oppositeFactor * (1 - distanceFactor)) * endControlDir
  return `M ${x1} ${y1} C ${x1 + startOffset} ${y1}, ${x2 + endOffset} ${y2}, ${x2} ${y2}`
}
