// 依赖线从端点水平离开、水平进入，中间用三次贝塞尔曲线连接。
export function calculateDependencyPath(startDir, x1, y1, x2, y2) {
  const sign = startDir === 'left' ? -1 : 1
  const handle = Math.max(Math.hypot(x2 - x1, y2 - y1) * 0.45, 36)
  const c1x = x1 + sign * handle
  const c2x = x2 - sign * handle
  return `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`
}
